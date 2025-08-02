const { ethers } = require('ethers');
const fs = require('fs');

async function verifyAllDay110() {
  console.log('🔍 Comprehensive Verification of ALL Day 110 Creates\n');
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  
  // Filter creates ending on day 110
  const day110Creates = cachedData.stakingData.createEvents.filter(create => {
    const maturityDate = new Date(create.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    return maturityDay === 110;
  });
  
  console.log(`Found ${day110Creates.length} creates ending on day 110 in cached data\n`);
  
  // Group by transaction hash to check
  const uniqueTxHashes = [...new Set(day110Creates.map(c => c.transactionHash))];
  console.log(`Unique transaction hashes: ${uniqueTxHashes.length}\n`);
  
  // Connect to Ethereum
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  console.log('Verifying each transaction on-chain...\n');
  
  let verified = 0;
  let failed = 0;
  const verificationResults = [];
  
  // Check each unique transaction
  for (let i = 0; i < uniqueTxHashes.length; i++) {
    const txHash = uniqueTxHashes[i];
    process.stdout.write(`\rChecking transaction ${i + 1}/${uniqueTxHashes.length}...`);
    
    try {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (tx && receipt && receipt.status === 1) {
        // Verify it's to the create/stake contract
        if (tx.to && tx.to.toLowerCase() === '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507') {
          verified++;
          const block = await provider.getBlock(tx.blockNumber);
          
          // Find all creates in this tx from our data
          const createsInTx = day110Creates.filter(c => c.transactionHash === txHash);
          
          verificationResults.push({
            txHash,
            blockNumber: tx.blockNumber,
            blockTime: new Date(block.timestamp * 1000).toISOString(),
            createsCount: createsInTx.length,
            verified: true
          });
        } else {
          failed++;
          verificationResults.push({
            txHash,
            error: 'Wrong contract address',
            verified: false
          });
        }
      } else {
        failed++;
        verificationResults.push({
          txHash,
          error: 'Transaction not found or failed',
          verified: false
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      failed++;
      verificationResults.push({
        txHash,
        error: error.message,
        verified: false
      });
    }
  }
  
  console.log('\n\n📊 Verification Results:\n');
  console.log(`✅ Verified transactions: ${verified}`);
  console.log(`❌ Failed transactions: ${failed}`);
  console.log(`📊 Total transactions checked: ${uniqueTxHashes.length}\n`);
  
  // Show failed transactions if any
  if (failed > 0) {
    console.log('Failed transactions:');
    verificationResults.filter(r => !r.verified).forEach(r => {
      console.log(`  ${r.txHash}: ${r.error}`);
    });
  }
  
  // Calculate total creates from verified transactions
  const totalVerifiedCreates = verificationResults
    .filter(r => r.verified)
    .reduce((sum, r) => sum + r.createsCount, 0);
  
  console.log(`\n✅ Total creates in verified transactions: ${totalVerifiedCreates}`);
  
  // Save detailed results
  fs.writeFileSync('day110-verification-results.json', JSON.stringify({
    summary: {
      totalCreatesInData: day110Creates.length,
      uniqueTransactions: uniqueTxHashes.length,
      verifiedTransactions: verified,
      failedTransactions: failed,
      totalVerifiedCreates
    },
    details: verificationResults
  }, null, 2));
  
  console.log('\nDetailed results saved to day110-verification-results.json');
  
  // Additional analysis
  console.log('\n📊 Additional Analysis:');
  
  // Check block range
  const blockNumbers = day110Creates.map(c => c.blockNumber).sort((a, b) => a - b);
  console.log(`Block range: ${blockNumbers[0]} to ${blockNumbers[blockNumbers.length - 1]}`);
  
  // Check time range
  const timestamps = day110Creates.map(c => new Date(parseInt(c.timestamp) * 1000));
  const earliest = new Date(Math.min(...timestamps));
  const latest = new Date(Math.max(...timestamps));
  console.log(`Time range: ${earliest.toISOString()} to ${latest.toISOString()}`);
  console.log(`Duration: ${((latest - earliest) / (1000 * 60 * 60)).toFixed(1)} hours`);
  
  // Verify all are 88-day duration
  const durations = day110Creates.map(c => {
    const start = parseInt(c.timestamp);
    const end = parseInt(c.endTime);
    return Math.round((end - start) / 86400);
  });
  const uniqueDurations = [...new Set(durations)];
  console.log(`\nUnique durations: ${uniqueDurations.join(', ')} days`);
  console.log(`All 88-day duration: ${uniqueDurations.length === 1 && uniqueDurations[0] === 88 ? 'YES ✅' : 'NO ❌'}`);
}

verifyAllDay110().catch(console.error);