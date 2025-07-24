const { ethers } = require('ethers');
const fs = require('fs');

async function verifyDay12Complete() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
  
  // Get Day 12 events
  const DAY_12_START = new Date('2025-07-21T00:00:00Z');
  const DAY_12_END = new Date('2025-07-22T00:00:00Z');
  
  const day12Creates = data.stakingData.createEvents.filter(e => {
    const ts = parseInt(e.timestamp) * 1000;
    return ts >= DAY_12_START.getTime() && ts < DAY_12_END.getTime();
  });
  
  const day12Stakes = data.stakingData.stakeEvents.filter(e => {
    const ts = parseInt(e.timestamp) * 1000;
    return ts >= DAY_12_START.getTime() && ts < DAY_12_END.getTime();
  });
  
  console.log('=== DAY 12 COMPLETE VERIFICATION ===\n');
  console.log(`Verifying ${day12Creates.length} creates and ${day12Stakes.length} stakes...\n`);
  
  // Verify Creates
  console.log('=== CREATES ===');
  let createsCorrect = 0;
  let createsMismatch = 0;
  
  // Sample first 5 creates
  for (let i = 0; i < Math.min(5, day12Creates.length); i++) {
    const create = day12Creates[i];
    console.log(`\nCreate ${i + 1} (User: ${create.user.substring(0, 10)}...):`);
    console.log(`  JSON TitanX: ${(parseFloat(create.titanXAmount || '0') / 1e18).toLocaleString()}`);
    console.log(`  JSON ETH: ${(parseFloat(create.ethAmount || '0') / 1e18).toFixed(4)}`);
    
    if (!create.transactionHash) {
      console.log('  ❌ No transaction hash');
      continue;
    }
    
    try {
      // Check transaction
      const tx = await provider.getTransaction(create.transactionHash);
      const block = await provider.getBlock(tx.blockNumber);
      
      // Check ETH payment
      const ethSent = parseFloat(ethers.utils.formatEther(tx.value));
      console.log(`  Chain ETH sent: ${ethSent.toFixed(4)}`);
      
      // Check TitanX transfers in same block
      const userAddress = ethers.utils.hexZeroPad(create.user.toLowerCase(), 32);
      const contractAddress = ethers.utils.hexZeroPad(CREATE_STAKE_CONTRACT.toLowerCase(), 32);
      
      const titanXLogs = await provider.getLogs({
        address: TITANX_CONTRACT,
        topics: [transferTopic, userAddress, contractAddress],
        fromBlock: tx.blockNumber,
        toBlock: tx.blockNumber
      });
      
      let titanXSent = ethers.BigNumber.from(0);
      titanXLogs.forEach(log => {
        // Check if this transfer is in our transaction
        if (log.transactionHash === create.transactionHash) {
          titanXSent = titanXSent.add(ethers.BigNumber.from(log.data));
        }
      });
      
      console.log(`  Chain TitanX sent: ${(parseFloat(titanXSent.toString()) / 1e18).toLocaleString()}`);
      
      // Compare
      const jsonTitanX = parseFloat(create.titanXAmount || '0');
      const chainTitanX = parseFloat(titanXSent.toString());
      const jsonETH = parseFloat(create.ethAmount || '0');
      const chainETH = ethSent * 1e18; // Convert to wei for comparison
      
      if (Math.abs(jsonTitanX - chainTitanX) < 1000 && Math.abs(jsonETH - chainETH) < 1000) {
        console.log('  ✅ Data matches blockchain');
        createsCorrect++;
      } else {
        console.log('  ❌ Data mismatch');
        createsMismatch++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Verify Stakes
  console.log('\n\n=== STAKES ===');
  let stakesWithPayment = 0;
  
  for (let i = 0; i < day12Stakes.length; i++) {
    const stake = day12Stakes[i];
    console.log(`\nStake ${i + 1} (User: ${stake.user.substring(0, 10)}...):`);
    console.log(`  JSON TitanX: ${(parseFloat(stake.rawCostTitanX || '0') / 1e18).toLocaleString()}`);
    console.log(`  JSON ETH: ${(parseFloat(stake.rawCostETH || '0') / 1e18).toFixed(4)}`);
    
    if (!stake.transactionHash) {
      console.log('  ❌ No transaction hash');
      continue;
    }
    
    try {
      // Check transaction
      const tx = await provider.getTransaction(stake.transactionHash);
      
      // Check ETH payment
      const ethSent = parseFloat(ethers.utils.formatEther(tx.value));
      console.log(`  Chain ETH sent: ${ethSent.toFixed(4)}`);
      
      // Check TitanX transfers
      const userAddress = ethers.utils.hexZeroPad(stake.user.toLowerCase(), 32);
      const contractAddress = ethers.utils.hexZeroPad(CREATE_STAKE_CONTRACT.toLowerCase(), 32);
      
      const titanXLogs = await provider.getLogs({
        address: TITANX_CONTRACT,
        topics: [transferTopic, userAddress, contractAddress],
        fromBlock: tx.blockNumber,
        toBlock: tx.blockNumber
      });
      
      let titanXSent = ethers.BigNumber.from(0);
      titanXLogs.forEach(log => {
        if (log.transactionHash === stake.transactionHash) {
          titanXSent = titanXSent.add(ethers.BigNumber.from(log.data));
        }
      });
      
      console.log(`  Chain TitanX sent: ${(parseFloat(titanXSent.toString()) / 1e18).toLocaleString()}`);
      
      if (titanXSent.gt(0) || ethSent > 0) {
        console.log('  💡 Payment found on chain!');
        stakesWithPayment++;
        
        // Update JSON if needed
        if (stake.rawCostTitanX === '0' && titanXSent.gt(0)) {
          stake.rawCostTitanX = titanXSent.toString();
          stake.costTitanX = titanXSent.toString();
        }
        if (stake.rawCostETH === '0' && ethSent > 0) {
          stake.rawCostETH = (ethSent * 1e18).toString();
          stake.costETH = (ethSent * 1e18).toString();
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log('\n\n=== SUMMARY ===');
  console.log(`Creates checked: ${Math.min(5, day12Creates.length)}`);
  console.log(`  Correct: ${createsCorrect}`);
  console.log(`  Mismatch: ${createsMismatch}`);
  console.log(`\nStakes checked: ${day12Stakes.length}`);
  console.log(`  With payment found: ${stakesWithPayment}`);
  
  if (stakesWithPayment > 0) {
    console.log('\n💾 Saving updated data...');
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  }
}

verifyDay12Complete().catch(console.error);