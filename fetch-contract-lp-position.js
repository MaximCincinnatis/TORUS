#!/usr/bin/env node

/**
 * Fetch and add the TORUS Protocol LP Position #1029195 to cached data
 * This is the official Buy&Process contract's LP position
 */

const { ethers } = require('ethers');
const fs = require('fs');
const { calculatePositionAmounts } = require('./shared/lpCalculations');

// Configuration
const CACHE_FILE = './public/data/cached-data.json';
const PROTOCOL_POSITION_ID = '1029195';
const CONTRACTS = {
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  NFT_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  BUY_PROCESS: '0xAa390a37006E22b5775A34f2147F81eBD6a63641'
};

// Try multiple RPC providers
const RPC_PROVIDERS = [
  'https://eth.llamarpc.com',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://ethereum.publicnode.com'
];

async function getWorkingProvider() {
  for (const rpc of RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpc}`);
      return provider;
    } catch (e) {
      console.log(`❌ Failed to connect to ${rpc}`);
    }
  }
  throw new Error('No working RPC provider found');
}

let provider;

async function fetchProtocolPosition() {
  console.log('🔧 Fetching TORUS Protocol LP Position #1029195\n');
  console.log('=' .repeat(60));
  
  // Get working provider
  provider = await getWorkingProvider();
  
  // Get current pool state
  const poolABI = [
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'
  ];
  const pool = new ethers.Contract(CONTRACTS.POOL, poolABI, provider);
  const slot0 = await pool.slot0();
  
  console.log('Current Pool State:');
  console.log(`  Tick: ${slot0.tick}`);
  console.log(`  SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}\n`);
  
  // Position Manager ABI
  const positionManagerABI = [
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ];
  
  const positionManager = new ethers.Contract(CONTRACTS.NFT_POSITION_MANAGER, positionManagerABI, provider);
  
  // Fetch position #1029195
  console.log(`Fetching Position #${PROTOCOL_POSITION_ID}:`);
  
  try {
    const [currentPosition, owner] = await Promise.all([
      positionManager.positions(PROTOCOL_POSITION_ID),
      positionManager.ownerOf(PROTOCOL_POSITION_ID)
    ]);
    
    // Verify it's owned by the Buy&Process contract
    if (owner.toLowerCase() !== CONTRACTS.BUY_PROCESS.toLowerCase()) {
      console.log(`⚠️ Warning: Position owner (${owner}) is not the Buy&Process contract!`);
    } else {
      console.log(`✅ Confirmed: Position owned by Buy&Process contract`);
    }
    
    // Calculate amounts
    const amounts = calculatePositionAmounts(
      currentPosition,
      slot0.sqrtPriceX96,
      slot0.tick
    );
    
    // Create position object
    const protocolPosition = {
      tokenId: PROTOCOL_POSITION_ID,
      owner: owner,
      liquidity: currentPosition.liquidity.toString(),
      tickLower: currentPosition.tickLower,
      tickUpper: currentPosition.tickUpper,
      tokensOwed0: currentPosition.tokensOwed0.toString(),
      tokensOwed1: currentPosition.tokensOwed1.toString(),
      amount0: amounts.amount0,
      amount1: amounts.amount1,
      torusAmount: amounts.amount0,
      wethAmount: amounts.amount1,
      // Calculate USD values (approximate)
      torusValue: amounts.amount0 * (amounts.amount1 > 0 ? (amounts.amount1 * 3200) / amounts.amount0 : 0),
      wethValue: amounts.amount1 * 3200,
      totalValue: 0, // Will calculate below
      // Add claimable fees
      claimableFees: {
        torus: parseFloat(currentPosition.tokensOwed0.toString()) / 1e18,
        weth: parseFloat(currentPosition.tokensOwed1.toString()) / 1e18
      },
      claimableTorus: parseFloat(currentPosition.tokensOwed0.toString()) / 1e18,
      claimableWeth: parseFloat(currentPosition.tokensOwed1.toString()) / 1e18,
      lastUpdated: new Date().toISOString(),
      isProtocolPosition: true
    };
    
    protocolPosition.totalValue = protocolPosition.torusValue + protocolPosition.wethValue;
    
    console.log(`\nPosition Details:`);
    console.log(`  Liquidity: ${currentPosition.liquidity.toString()}`);
    console.log(`  TORUS Amount: ${amounts.amount0.toFixed(2)}`);
    console.log(`  WETH Amount: ${amounts.amount1.toFixed(4)}`);
    console.log(`  Tick Range: ${currentPosition.tickLower} to ${currentPosition.tickUpper}`);
    
    // Load cached data
    const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    
    // Initialize lpPositions if it doesn't exist
    if (!cachedData.lpPositions) {
      cachedData.lpPositions = [];
    }
    
    // Remove any existing entry for this position
    cachedData.lpPositions = cachedData.lpPositions.filter(p => p.tokenId !== PROTOCOL_POSITION_ID);
    
    // Add the protocol position at the beginning
    cachedData.lpPositions.unshift(protocolPosition);
    
    // Update pool data
    cachedData.poolData = cachedData.poolData || {};
    cachedData.poolData.currentTick = slot0.tick;
    cachedData.poolData.sqrtPriceX96 = slot0.sqrtPriceX96.toString();
    cachedData.poolData.lastUpdated = new Date().toISOString();
    
    // Save updated data
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ Successfully added Protocol Position #1029195 to cached data');
    console.log(`   Total LP positions in cache: ${cachedData.lpPositions.length}`);
    
    return true;
    
  } catch (error) {
    console.error(`\n❌ Error fetching position: ${error.message}`);
    return false;
  }
}

// Run the fetch
fetchProtocolPosition()
  .then(success => {
    if (success) {
      console.log('\n🎯 Next: The dashboard should now display the LP position');
      process.exit(0);
    } else {
      console.log('\n⚠️ Failed to fetch position. Please check the error above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });