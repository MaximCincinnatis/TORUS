const { ethers } = require('ethers');

async function analyzeBurnETHAmounts() {
  console.log('🔍 Analyzing ETH amounts in Buy & Burn operations...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Contract ABI
  const contractABI = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'function ethUsedForBurns() view returns (uint256)',
    'function titanXUsedForBurns() view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
  
  try {
    // Get total ETH used for burns from contract
    const ethUsedForBurns = await contract.ethUsedForBurns();
    console.log('Total ETH used for burns (from contract):', ethers.utils.formatEther(ethUsedForBurns), 'ETH\n');
    
    // Get BuyAndBurn events
    const currentBlock = await provider.getBlockNumber();
    const DEPLOYMENT_BLOCK = 22890272;
    
    console.log('Fetching BuyAndBurn events to analyze transactions...');
    
    const burnEvents = [];
    const chunkSize = 5000;
    
    for (let start = DEPLOYMENT_BLOCK; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      try {
        const events = await contract.queryFilter(contract.filters.BuyAndBurn(), start, end);
        burnEvents.push(...events);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`Found ${burnEvents.length} BuyAndBurn events\n`);
    
    // Analyze transactions for ETH values
    console.log('Analyzing burn transactions for ETH values...\n');
    
    let totalETHFromTxs = ethers.BigNumber.from(0);
    let ethBurns = 0;
    let titanXBurns = 0;
    
    // Function selectors for burn functions
    const SWAP_ETH_FOR_TORUS_AND_BURN = '0x1e7d0fb0'; // swapETHForTorusAndBurn
    const SWAP_TITANX_FOR_TORUS_AND_BURN = '0x8d2fa3f9'; // swapTitanXForTorusAndBurn
    
    console.log('Sample burn transactions:');
    console.log('------------------------');
    
    for (let i = 0; i < Math.min(10, burnEvents.length); i++) {
      const event = burnEvents[i];
      
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        const functionSelector = tx.data.slice(0, 10);
        
        console.log(`\nTx ${i + 1}: ${event.transactionHash}`);
        console.log(`  Block: ${event.blockNumber}`);
        console.log(`  TORUS burned: ${ethers.utils.formatEther(event.args.torusBurnt)} TORUS`);
        console.log(`  TitanX amount: ${ethers.utils.formatEther(event.args.titanXAmount)} TitanX`);
        console.log(`  ETH value: ${ethers.utils.formatEther(tx.value)} ETH`);
        console.log(`  Function: ${functionSelector}`);
        
        if (tx.value.gt(0)) {
          totalETHFromTxs = totalETHFromTxs.add(tx.value);
          ethBurns++;
          console.log(`  Type: ETH Burn`);
        } else {
          titanXBurns++;
          console.log(`  Type: TitanX Burn`);
        }
        
      } catch (error) {
        console.log(`Error fetching transaction: ${error.message}`);
      }
    }
    
    console.log('\n\nFull analysis of all burns:');
    console.log('---------------------------');
    
    // Analyze all burns
    totalETHFromTxs = ethers.BigNumber.from(0);
    ethBurns = 0;
    titanXBurns = 0;
    
    for (const event of burnEvents) {
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        
        if (tx.value.gt(0)) {
          totalETHFromTxs = totalETHFromTxs.add(tx.value);
          ethBurns++;
        } else {
          titanXBurns++;
        }
      } catch (error) {
        console.log(`Error processing tx ${event.transactionHash}`);
      }
    }
    
    console.log(`\nTotal burns: ${burnEvents.length}`);
    console.log(`- ETH burns: ${ethBurns}`);
    console.log(`- TitanX burns: ${titanXBurns}`);
    console.log(`\nTotal ETH from burn transactions: ${ethers.utils.formatEther(totalETHFromTxs)} ETH`);
    console.log(`Contract ethUsedForBurns: ${ethers.utils.formatEther(ethUsedForBurns)} ETH`);
    
    const difference = ethUsedForBurns.sub(totalETHFromTxs);
    console.log(`\nDifference: ${ethers.utils.formatEther(difference)} ETH`);
    
    if (difference.gt(0)) {
      console.log('\nNote: The difference might be due to:');
      console.log('- Internal contract mechanisms');
      console.log('- ETH sent directly to the contract');
      console.log('- Other functions that contribute to burns');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeBurnETHAmounts().catch(console.error);