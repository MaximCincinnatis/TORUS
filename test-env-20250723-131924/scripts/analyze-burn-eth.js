const { ethers } = require('ethers');

async function analyzeBurnETH() {
  console.log('🔥 Analyzing Buy & Burn ETH usage...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  const contractABI = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'function ethUsedForBurns() view returns (uint256)',
    'function ethUsedForBuilds() view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
  
  // Get totals
  const [ethForBurns, ethForBuilds] = await Promise.all([
    contract.ethUsedForBurns(),
    contract.ethUsedForBuilds()
  ]);
  
  console.log('Contract State Variables:');
  console.log('ETH used for burns:', ethers.utils.formatEther(ethForBurns));
  console.log('ETH used for builds:', ethers.utils.formatEther(ethForBuilds));
  console.log('Total ETH used:', ethers.utils.formatEther(ethForBurns.add(ethForBuilds)));
  
  // Get some recent burn events to analyze
  const currentBlock = await provider.getBlockNumber();
  const events = await contract.queryFilter(
    contract.filters.BuyAndBurn(),
    currentBlock - 10000,
    currentBlock
  );
  
  console.log(`\nAnalyzing ${events.length} recent burn events...`);
  
  // Check a few transactions
  let ethBurns = 0;
  let titanXBurns = 0;
  
  for (let i = 0; i < Math.min(10, events.length); i++) {
    const event = events[i];
    const tx = await provider.getTransaction(event.transactionHash);
    const functionSelector = tx.data.slice(0, 10);
    
    // Known function selectors:
    // swapETHForTorusAndBurn: 0x1e7d0fb0
    // swapTitanXForTorusAndBurn: 0x8d2fa3f9
    
    if (functionSelector === '0x1e7d0fb0') {
      console.log(`  ETH burn - TitanX: ${ethers.utils.formatEther(event.args.titanXAmount)}`);
      ethBurns++;
    } else if (functionSelector === '0x8d2fa3f9') {
      console.log(`  TitanX burn - TitanX: ${ethers.utils.formatEther(event.args.titanXAmount)}`);
      titanXBurns++;
    } else {
      console.log(`  Unknown burn type: ${functionSelector}`);
    }
  }
  
  console.log(`\nOut of ${Math.min(10, events.length)} samples:`);
  console.log(`  ETH burns: ${ethBurns}`);
  console.log(`  TitanX burns: ${titanXBurns}`);
}

analyzeBurnETH().catch(console.error);