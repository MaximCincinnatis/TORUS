#!/usr/bin/env node

/**
 * Incremental LP Position Updater
 * 
 * Updates LP positions without losing existing data
 * - Fetches complete position data with token amounts and fees
 * - Merges with existing positions
 * - Preserves manually added data
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
const CACHE_FILE = './public/data/cached-data.json';

// Contract addresses
const CONTRACTS = {
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1',
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  NFT_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
};

// Colors for console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${colors[color]}${message}${colors.reset}`);
}

// Get working RPC provider
async function getProvider() {
  const providers = [
    'https://eth.drpc.org',
    'https://rpc.payload.de',
    'https://eth-mainnet.public.blastapi.io',
    'https://rpc.flashbots.net'
  ];
  
  for (const url of providers) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      log(`Connected to ${url}`, 'green');
      return provider;
    } catch (e) {
      continue;
    }
  }
  throw new Error('No working RPC providers');
}

// Calculate token amounts (from frontend logic)
function calculateTokenAmounts(liquidity, sqrtPriceX96, tickLower, tickUpper) {
  const liquidityBN = BigInt(liquidity);
  const sqrtPrice = BigInt(sqrtPriceX96);
  const Q96 = BigInt(2) ** BigInt(96);
  
  const priceLower = Math.pow(1.0001, tickLower);
  const priceUpper = Math.pow(1.0001, tickUpper);
  
  const sqrtPriceLowerFloat = Math.sqrt(priceLower) * Math.pow(2, 96);
  const sqrtPriceUpperFloat = Math.sqrt(priceUpper) * Math.pow(2, 96);
  
  const sqrtPriceLower = BigInt(Math.floor(sqrtPriceLowerFloat));
  const sqrtPriceUpper = BigInt(Math.floor(sqrtPriceUpperFloat));
  
  let amount0 = BigInt(0);
  let amount1 = BigInt(0);
  
  if (sqrtPrice <= sqrtPriceLower) {
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower) * Q96) / 
      (sqrtPriceUpper * sqrtPriceLower);
  } else if (sqrtPrice < sqrtPriceUpper) {
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPrice) * Q96) / 
      (sqrtPriceUpper * sqrtPrice);
    amount1 = (liquidityBN * (sqrtPrice - sqrtPriceLower)) / Q96;
  } else {
    amount1 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
  }
  
  const decimals0 = BigInt(10) ** BigInt(18);
  const decimals1 = BigInt(10) ** BigInt(18);
  
  const decimal0 = Number(amount0) / Number(decimals0);
  const decimal1 = Number(amount1) / Number(decimals1);
  
  return {
    amount0: decimal0,
    amount1: decimal1
  };
}

// Fetch complete position data
async function fetchPositionData(tokenId, provider, slot0) {
  try {
    const positionManagerABI = [
      'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
      'function ownerOf(uint256 tokenId) view returns (address)'
    ];
    
    const positionManager = new ethers.Contract(CONTRACTS.NFT_POSITION_MANAGER, positionManagerABI, provider);
    
    const [position, owner] = await Promise.all([
      positionManager.positions(tokenId),
      positionManager.ownerOf(tokenId).catch(() => null)
    ]);
    
    // Skip if no owner or no liquidity
    if (!owner || position.liquidity.toString() === '0') {
      return null;
    }
    
    // Verify this is TORUS pool
    if (position.token0.toLowerCase() !== CONTRACTS.TORUS.toLowerCase() ||
        position.token1.toLowerCase() !== CONTRACTS.TITANX.toLowerCase()) {
      return null;
    }
    
    // Calculate token amounts
    const amounts = calculateTokenAmounts(
      position.liquidity.toString(),
      slot0.sqrtPriceX96.toString(),
      position.tickLower,
      position.tickUpper
    );
    
    // Calculate claimable fees
    let claimableTorus = 0;
    let claimableTitanX = 0;
    
    try {
      const collectInterface = new ethers.utils.Interface([
        'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)'
      ]);
      
      const collectParams = {
        tokenId: tokenId,
        recipient: owner,
        amount0Max: '0xffffffffffffffffffffffffffffffff',
        amount1Max: '0xffffffffffffffffffffffffffffffff'
      };
      
      const collectData = collectInterface.encodeFunctionData('collect', [collectParams]);
      const result = await provider.call({
        to: CONTRACTS.NFT_POSITION_MANAGER,
        data: collectData,
        from: owner
      });
      
      const decoded = collectInterface.decodeFunctionResult('collect', result);
      claimableTorus = parseFloat(ethers.utils.formatEther(decoded.amount0));
      claimableTitanX = parseFloat(ethers.utils.formatEther(decoded.amount1));
    } catch (e) {
      // Fallback to tokensOwed
      claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
      claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
    }
    
    // Calculate APR
    const currentTick = slot0.tick;
    const inRange = position.tickLower <= currentTick && currentTick <= position.tickUpper;
    const titanxPerTorus = Math.pow(1.0001, currentTick);
    const positionValueTORUS = amounts.amount0 + (amounts.amount1 / titanxPerTorus);
    const totalClaimableTORUS = claimableTorus + (claimableTitanX / titanxPerTorus);
    
    let estimatedAPR = 0;
    if (positionValueTORUS > 0) {
      const weeklyYieldRate = totalClaimableTORUS / positionValueTORUS;
      estimatedAPR = weeklyYieldRate * 52 * 100;
      
      if (!inRange) {
        estimatedAPR = Math.min(estimatedAPR * 0.1, 5);
      }
      
      // Apply range factor
      const tickRange = position.tickUpper - position.tickLower;
      const rangeFactor = Math.max(0.5, Math.min(2.0, 500000 / tickRange));
      estimatedAPR = estimatedAPR * rangeFactor;
      
      // Cap at reasonable bounds
      estimatedAPR = Math.max(0, Math.min(estimatedAPR, 300));
    }
    
    // Format price range
    const lowerPrice = Math.pow(1.0001, position.tickLower);
    const upperPrice = Math.pow(1.0001, position.tickUpper);
    const isFullRange = position.tickLower <= -887200 && position.tickUpper >= 887200;
    
    let priceRange;
    if (isFullRange) {
      priceRange = 'Full Range';
    } else {
      const lowerDisplay = lowerPrice > 1e10 ? 'Infinity' : lowerPrice.toFixed(3);
      const upperDisplay = upperPrice > 1e10 ? 'Infinity' : upperPrice.toFixed(3);
      priceRange = `${lowerDisplay} - ${upperDisplay}`;
    }
    
    return {
      tokenId: tokenId,
      owner: owner,
      liquidity: position.liquidity.toString(),
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      lowerTitanxPerTorus: lowerPrice.toFixed(3),
      upperTitanxPerTorus: upperPrice.toFixed(3),
      currentTitanxPerTorus: titanxPerTorus.toFixed(3),
      amount0: amounts.amount0,
      amount1: amounts.amount1,
      claimableTorus: claimableTorus,
      claimableTitanX: claimableTitanX,
      tokensOwed0: position.tokensOwed0.toString(),
      tokensOwed1: position.tokensOwed1.toString(),
      fee: position.fee,
      inRange: inRange,
      estimatedAPR: estimatedAPR.toFixed(2),
      priceRange: priceRange,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (e) {
    log(`Error fetching position ${tokenId}: ${e.message}`, 'red');
    return null;
  }
}

// Main update function
async function updateLPPositions() {
  log('🔄 Starting incremental LP position update', 'bright');
  
  try {
    // Load cached data
    const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const existingPositions = cachedData.lpPositions || [];
    
    log(`Found ${existingPositions.length} existing positions`, 'cyan');
    
    // Get provider and current pool state
    const provider = await getProvider();
    
    const poolABI = [
      'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)',
      'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
    ];
    
    const poolContract = new ethers.Contract(CONTRACTS.POOL, poolABI, provider);
    const slot0 = await poolContract.slot0();
    
    // Create position map for merging
    const positionMap = new Map();
    
    // Add existing positions to map
    existingPositions.forEach(pos => {
      positionMap.set(pos.tokenId, pos);
    });
    
    // Update existing positions
    log('Updating existing positions...', 'cyan');
    let updatedCount = 0;
    let removedCount = 0;
    
    for (const position of existingPositions) {
      const newData = await fetchPositionData(position.tokenId, provider, slot0);
      
      if (newData) {
        // Preserve any custom fields from existing position
        positionMap.set(position.tokenId, {
          ...position,
          ...newData,
          // Preserve manual overrides
          manualData: position.manualData,
          customNotes: position.customNotes,
          originalData: position.originalData
        });
        updatedCount++;
      } else {
        // Position no longer exists or has no liquidity
        positionMap.delete(position.tokenId);
        removedCount++;
        log(`  Removed position ${position.tokenId}`, 'yellow');
      }
    }
    
    log(`Updated ${updatedCount} positions, removed ${removedCount}`, 'green');
    
    // Check for new positions from recent Mint events
    log('Checking for new positions...', 'cyan');
    
    const currentBlock = await provider.getBlockNumber();
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, currentBlock - 1000, currentBlock);
    
    log(`Found ${mintEvents.length} recent Mint events`, 'cyan');
    
    // Known positions to check (from working implementation)
    const knownTokenIds = ['1029195', '1032346', '780889', '797216', '798833'];
    
    // Check known positions
    for (const tokenId of knownTokenIds) {
      if (!positionMap.has(tokenId)) {
        const positionData = await fetchPositionData(tokenId, provider, slot0);
        if (positionData) {
          positionMap.set(tokenId, positionData);
          log(`  Added known position ${tokenId}`, 'green');
        }
      }
    }
    
    // Convert map back to array
    const updatedPositions = Array.from(positionMap.values());
    
    // Update cached data
    cachedData.lpPositions = updatedPositions;
    
    // Also update in uniswapV3 section if it exists
    if (cachedData.uniswapV3) {
      cachedData.uniswapV3.lpPositions = updatedPositions;
    }
    
    // Update pool data
    if (cachedData.poolData) {
      cachedData.poolData.currentTick = slot0.tick;
      cachedData.poolData.sqrtPriceX96 = slot0.sqrtPriceX96.toString();
    }
    
    if (cachedData.uniswapV3?.poolData) {
      cachedData.uniswapV3.poolData.currentTick = slot0.tick;
      cachedData.uniswapV3.poolData.sqrtPriceX96 = slot0.sqrtPriceX96.toString();
    }
    
    // Update timestamp
    cachedData.lastUpdated = new Date().toISOString();
    
    // Create backup
    const backupPath = `public/data/backups/cached-data-${new Date().toISOString().replace(/:/g, '-')}.json`;
    const backupDir = './public/data/backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    
    // Save updated data
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedData, null, 2));
    
    log(`✅ Update complete! Total positions: ${updatedPositions.length}`, 'green');
    
  } catch (e) {
    log(`❌ Error updating LP positions: ${e.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateLPPositions().catch(console.error);
}

module.exports = { updateLPPositions };