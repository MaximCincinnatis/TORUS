const { ethers } = require('ethers');
const fs = require('fs');

async function simpleVerify() {
  console.log('🔍 Simple On-Chain Verification of Day 110 Creates\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  // Sample transactions from our data
  const sampleTxs = [
    '0x66596d732d827e83ba522df8e592ae8b3baacdf22ae7e4a88b9b678e6a11c312',
    '0x48d5a500c58cca0f56267c9b8464cd53d2559f01d2568ae9cbb18a18f206c039'
  ];
  
  console.log('Checking sample transactions:\n');
  
  for (const txHash of sampleTxs) {
    try {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      const block = await provider.getBlock(tx.blockNumber);
      
      console.log(`Transaction: ${txHash}`);
      console.log(`  Block: ${tx.blockNumber}`);
      console.log(`  From: ${tx.from}`);
      console.log(`  To: ${tx.to}`);
      console.log(`  Block Time: ${new Date(block.timestamp * 1000).toISOString()}`);
      console.log(`  Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
      console.log(`  Logs: ${receipt.logs.length} events\n`);
      
      // Check if this is to the create/stake contract
      if (tx.to && tx.to.toLowerCase() === '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507') {
        console.log('  ✅ Transaction is to Create/Stake contract\n');
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }
  
  // Now let's count creates in our cached data by protocol day
  console.log('\n📊 Creates by Protocol Day from Cached Data:\n');
  
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const createsByDay = {};
  
  cachedData.stakingData.createEvents.forEach(create => {
    const day = create.protocolDay;
    if (!createsByDay[day]) createsByDay[day] = 0;
    createsByDay[day]++;
  });
  
  // Show days with most creates
  const sortedDays = Object.entries(createsByDay)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('Top 10 days by create count:');
  sortedDays.forEach(([day, count]) => {
    console.log(`  Day ${day}: ${count} creates`);
  });
  
  // Check day 22 specifically
  console.log(`\n📍 Day 22 specifically: ${createsByDay[22] || 0} creates`);
  
  // Count by maturity day
  console.log('\n📊 Creates by Maturity Day:\n');
  
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const createsByMaturityDay = {};
  
  cachedData.stakingData.createEvents.forEach(create => {
    const maturityDate = new Date(create.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    if (!createsByMaturityDay[maturityDay]) createsByMaturityDay[maturityDay] = 0;
    createsByMaturityDay[maturityDay]++;
  });
  
  // Show days with most maturities
  const sortedMaturityDays = Object.entries(createsByMaturityDay)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('Top 10 maturity days:');
  sortedMaturityDays.forEach(([day, count]) => {
    console.log(`  Day ${day}: ${count} creates maturing`);
  });
  
  console.log(`\n📍 Day 110 specifically: ${createsByMaturityDay[110] || 0} creates maturing`);
  
  // Verify the pattern
  const day22Creates = cachedData.stakingData.createEvents.filter(c => c.protocolDay === 22);
  const day22With88Days = day22Creates.filter(c => {
    const startTime = parseInt(c.timestamp);
    const endTime = parseInt(c.endTime);
    const duration = Math.round((endTime - startTime) / 86400);
    return duration === 88;
  });
  
  console.log(`\n✅ Verification Summary:`);
  console.log(`  - Total creates on Day 22: ${day22Creates.length}`);
  console.log(`  - Creates with 88-day duration: ${day22With88Days.length}`);
  console.log(`  - These should all mature on Day 110 (22 + 88 = 110)`);
}

simpleVerify().catch(console.error);