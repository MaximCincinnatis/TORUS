const { ethers } = require('ethers');
const fs = require('fs');

async function analyzeManyStakes() {
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  console.log('Analyzing a broader sample of stake transactions...\n');
  
  // Get a sample of stakes across the dataset
  const stakeEvents = data.stakingData.stakeEvents;
  const sampleIndices = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130];
  
  const TITANX = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1';
  const STAKE_CONTRACT = '0xc7Cc775B21f9Df85E043C7FDd9dAC60af0B69507';
  const TRANSFER_TOPIC = ethers.utils.id('Transfer(address,address,uint256)');
  
  const results = [];
  
  for (const idx of sampleIndices) {
    if (idx >= stakeEvents.length) break;
    const stake = stakeEvents[idx];
    
    try {
      process.stdout.write(`\rProcessing stake ${idx + 1}...`);
      const receipt = await provider.getTransactionReceipt(stake.transactionHash);
      
      // Find TitanX transfers to stake contract
      let titanXAmount = '0';
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === TITANX.toLowerCase() && 
            log.topics[0] === TRANSFER_TOPIC) {
          const to = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
          if (to.toLowerCase() === STAKE_CONTRACT.toLowerCase()) {
            titanXAmount = ethers.utils.formatEther(log.data);
            break;
          }
        }
      }
      
      const titanXNum = parseFloat(titanXAmount);
      results.push({
        idx: idx,
        tx: stake.transactionHash.slice(0, 10),
        shown: parseFloat(stake.costTitanX),
        actual: titanXNum,
        actualFormatted: titanXNum > 1e9 ? (titanXNum / 1e9).toFixed(3) + 'B' :
                         titanXNum > 1e6 ? (titanXNum / 1e6).toFixed(2) + 'M' :
                         titanXNum.toFixed(2)
      });
      
    } catch (error) {
      console.log(`\nError processing stake ${idx}:`, error.message);
    }
  }
  
  console.log('\n\nResults:\n');
  console.log('Index | TX         | Shown    | Actual         | Ratio');
  console.log('------|------------|----------|----------------|----------');
  results.forEach(r => {
    const ratio = r.actual > 0 ? (r.actual / r.shown).toFixed(0) + 'x' : 'N/A';
    console.log(`${r.idx.toString().padStart(5)} | ${r.tx} | ${r.shown.toString().padEnd(8)} | ${r.actualFormatted.padEnd(14)} | ${ratio}`);
  });
  
  // Summary statistics
  const validResults = results.filter(r => r.actual > 0);
  const totalShown = validResults.reduce((sum, r) => sum + r.shown, 0);
  const totalActual = validResults.reduce((sum, r) => sum + r.actual, 0);
  
  console.log('\nSummary:');
  console.log(`Analyzed ${results.length} stakes`);
  console.log(`Total shown in our data: ${totalShown.toFixed(2)} TitanX`);
  console.log(`Total actual on-chain: ${(totalActual / 1e9).toFixed(3)} billion TitanX`);
  console.log(`Average multiplier: ${(totalActual / totalShown).toFixed(0)}x`);
  
  // Check size distribution
  const sizes = validResults.map(r => r.actual).sort((a, b) => b - a);
  console.log('\nSize distribution:');
  console.log(`Largest: ${(sizes[0] / 1e9).toFixed(3)}B TitanX`);
  console.log(`Median: ${(sizes[Math.floor(sizes.length / 2)] / 1e6).toFixed(2)}M TitanX`);
  console.log(`Smallest: ${(sizes[sizes.length - 1] / 1e6).toFixed(2)}M TitanX`);
}

analyzeManyStakes().catch(console.error);