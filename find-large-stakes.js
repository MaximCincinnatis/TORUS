const { ethers } = require('ethers');
const fs = require('fs');

async function findLargeStakes() {
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  console.log('Searching for large TitanX stakes (>1B)...\n');
  
  const stakeEvents = data.stakingData.stakeEvents;
  const TITANX = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1';
  const STAKE_CONTRACT = '0xc7Cc775B21f9Df85E043C7FDd9dAC60af0B69507';
  const TRANSFER_TOPIC = ethers.utils.id('Transfer(address,address,uint256)');
  
  // Check stakes with larger "shown" values (might correlate with larger actual)
  const stakesToCheck = stakeEvents
    .map((stake, idx) => ({ stake, idx, shown: parseFloat(stake.costTitanX) }))
    .sort((a, b) => b.shown - a.shown)
    .slice(0, 30); // Check top 30 by shown value
  
  const results = [];
  
  for (let i = 0; i < stakesToCheck.length; i++) {
    const { stake, idx, shown } = stakesToCheck[i];
    
    try {
      process.stdout.write(`\rChecking stake ${i + 1}/${stakesToCheck.length}...`);
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
      if (titanXNum > 1e9) { // Over 1 billion
        results.push({
          idx,
          tx: stake.transactionHash,
          shown,
          actual: titanXNum,
          actualB: (titanXNum / 1e9).toFixed(3),
          user: stake.user
        });
      }
      
      // Small delay to avoid rate limits
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.log(`\nError processing stake ${idx}:`, error.message);
    }
  }
  
  console.log('\n\nStakes with over 1 billion TitanX:\n');
  console.log('Index | Shown | Actual    | User                                     | TX');
  console.log('------|-------|-----------|------------------------------------------|----------');
  
  results.sort((a, b) => b.actual - a.actual).forEach(r => {
    console.log(`${r.idx.toString().padStart(5)} | ${r.shown.toString().padStart(5)} | ${r.actualB}B | ${r.user} | ${r.tx.slice(0, 10)}...`);
  });
  
  console.log(`\nFound ${results.length} stakes with over 1B TitanX`);
  
  // Also check some random stakes to see distribution
  console.log('\n\nChecking 10 random stakes for comparison:');
  const randomIndices = Array.from({length: 10}, () => Math.floor(Math.random() * stakeEvents.length));
  
  for (const idx of randomIndices) {
    const stake = stakeEvents[idx];
    try {
      const receipt = await provider.getTransactionReceipt(stake.transactionHash);
      
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
      const formatted = titanXNum > 1e9 ? (titanXNum / 1e9).toFixed(3) + 'B' :
                       titanXNum > 1e6 ? (titanXNum / 1e6).toFixed(1) + 'M' :
                       titanXNum.toFixed(0);
      console.log(`Stake ${idx}: shown=${stake.costTitanX}, actual=${formatted}`);
      
    } catch (error) {
      console.log(`Error with stake ${idx}`);
    }
  }
}

findLargeStakes().catch(console.error);