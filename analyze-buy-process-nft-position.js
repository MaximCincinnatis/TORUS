const { ethers } = require('ethers');

async function analyzeBuyProcessNFTPosition() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const TITANX_TOKEN = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  const NFT_TOKEN_ID = 1029195; // The position we found
  
  console.log('🔍 Analyzing Buy & Process NFT Position #1029195\n');
  
  const NFT_MANAGER_ABI = [
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)',
    'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
  ];
  
  const BUY_PROCESS_ABI = [
    // Common function signatures we might find
    'function collectFees() external',
    'function collectAndBurn() external',
    'function burnCollectedFees() external',
    'function collectFeesAndBurn() external',
    'function harvestAndBurn() external',
    'function compound() external',
    'event TorusBurned(uint256 amount)',
    'event FeesCollected(uint256 amount0, uint256 amount1)',
    'event BurnExecuted(uint256 torusAmount, uint256 titanxAmount)'
  ];
  
  const nftManager = new ethers.Contract(NFT_POSITION_MANAGER, NFT_MANAGER_ABI, provider);
  
  try {
    // Get current position details
    console.log('Current Position Details:');
    const position = await nftManager.positions(NFT_TOKEN_ID);
    const owner = await nftManager.ownerOf(NFT_TOKEN_ID);
    
    console.log(`  Owner: ${owner}`);
    console.log(`  Owner is Buy & Process: ${owner.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    console.log(`  Token0 (TORUS): ${position.token0}`);
    console.log(`  Token1 (TitanX): ${position.token1}`);
    console.log(`  Fee Tier: ${position.fee / 10000}%`);
    console.log(`  Current Liquidity: ${ethers.utils.formatEther(position.liquidity)}`);
    console.log(`  Uncollected TORUS: ${ethers.utils.formatEther(position.tokensOwed0)} TORUS`);
    console.log(`  Uncollected TitanX: ${ethers.utils.formatEther(position.tokensOwed1)} TitanX\n`);
    
    // Calculate USD value of uncollected fees (rough estimate)
    const torusUncollected = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
    const titanxUncollected = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
    
    console.log('Uncollected Fees Analysis:');
    console.log(`  TORUS: ${torusUncollected.toFixed(2)} tokens`);
    console.log(`  TitanX: ${titanxUncollected.toFixed(2)} tokens`);
    console.log(`  Note: These fees can be collected by the Buy & Process contract\n`);
    
    // Look for Collect events for this specific NFT
    console.log('Searching for fee collection history...');
    const currentBlock = await provider.getBlockNumber();
    const collectFilter = nftManager.filters.Collect(NFT_TOKEN_ID);
    
    // Search in chunks to avoid timeouts
    const chunkSize = 10000;
    const searchBlocks = 500000; // Search last ~500k blocks
    let allCollects = [];
    
    for (let i = 0; i < searchBlocks; i += chunkSize) {
      const fromBlock = currentBlock - searchBlocks + i;
      const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
      
      try {
        const collects = await nftManager.queryFilter(collectFilter, fromBlock, toBlock);
        if (collects.length > 0) {
          allCollects.push(...collects);
          console.log(`  Found ${collects.length} collect events in blocks ${fromBlock}-${toBlock}`);
        }
      } catch (e) {
        // Skip chunk on error
      }
      
      // Progress indicator
      if (i % 50000 === 0 && i > 0) {
        console.log(`  Searched ${i / 1000}k blocks...`);
      }
    }
    
    console.log(`\nTotal fee collections found: ${allCollects.length}`);
    
    if (allCollects.length > 0) {
      console.log('\nFee Collection History:');
      let totalTorus = ethers.BigNumber.from(0);
      let totalTitanX = ethers.BigNumber.from(0);
      
      for (const collect of allCollects) {
        const block = await provider.getBlock(collect.blockNumber);
        const date = new Date(block.timestamp * 1000);
        
        console.log(`\nCollection on ${date.toISOString()}:`);
        console.log(`  Block: ${collect.blockNumber}`);
        console.log(`  TORUS collected: ${ethers.utils.formatEther(collect.args.amount0)}`);
        console.log(`  TitanX collected: ${ethers.utils.formatEther(collect.args.amount1)}`);
        console.log(`  Recipient: ${collect.args.recipient}`);
        console.log(`  Tx: ${collect.transactionHash}`);
        
        totalTorus = totalTorus.add(collect.args.amount0);
        totalTitanX = totalTitanX.add(collect.args.amount1);
      }
      
      console.log('\nTotal Fees Collected All Time:');
      console.log(`  TORUS: ${ethers.utils.formatEther(totalTorus)}`);
      console.log(`  TitanX: ${ethers.utils.formatEther(totalTitanX)}`);
    }
    
    // Check Buy & Process contract for burn functions
    console.log('\n\nAnalyzing Buy & Process Contract for Burn Mechanisms...');
    
    const contractCode = await provider.getCode(BUY_PROCESS_CONTRACT);
    console.log(`Contract code size: ${contractCode.length} bytes`);
    
    // Look for common function selectors
    const functionSelectors = {
      '0x4e71d92d': 'claim() or collectFees()',
      '0x66666aa9': 'burnCollectedFees()',
      '0xdcc50888': 'collectAndBurn()',
      '0x42966c68': 'burn(uint256)',
      '0x89afcb44': 'burn(address)',
      '0x6a627842': 'mint(address)',
      '0x3ccfd60b': 'withdraw()',
      '0x690d8320': 'withdrawTo(address)',
      '0x853828b6': 'withdrawAll()',
      '0xfc6f9468': 'harvestAndBurn()',
      '0xab5e124a': 'collectFees(uint256)',
      '0x57e0c50d': 'burnFees()'
    };
    
    console.log('\nChecking for burn-related function selectors:');
    const foundFunctions = [];
    
    for (const [selector, name] of Object.entries(functionSelectors)) {
      if (contractCode.toLowerCase().includes(selector.slice(2).toLowerCase())) {
        console.log(`  ✅ Found: ${name} (${selector})`);
        foundFunctions.push(name);
      }
    }
    
    if (foundFunctions.length === 0) {
      console.log('  No standard burn function selectors found. Contract may use custom function names.');
    }
    
    // Check recent transactions to the contract
    console.log('\n\nChecking recent Buy & Process contract transactions...');
    
    const txFilter = {
      address: BUY_PROCESS_CONTRACT,
      fromBlock: currentBlock - 1000,
      toBlock: currentBlock
    };
    
    const logs = await provider.getLogs(txFilter);
    console.log(`Found ${logs.length} events in last 1000 blocks`);
    
    if (logs.length > 0) {
      // Get unique event signatures
      const eventSigs = new Set();
      logs.forEach(log => {
        if (log.topics[0]) {
          eventSigs.add(log.topics[0]);
        }
      });
      
      console.log(`\nUnique event signatures: ${eventSigs.size}`);
      eventSigs.forEach(sig => {
        console.log(`  ${sig}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeBuyProcessNFTPosition().catch(console.error);