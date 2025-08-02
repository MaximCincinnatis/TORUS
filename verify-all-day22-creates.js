const { ethers } = require('ethers');
const fs = require('fs');

async function verifyAllDay22Creates() {
  console.log('🔍 Comprehensive Verification of ALL Day 22 Creates\n');
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Filter creates from day 22
  const day22Creates = cachedData.stakingData.createEvents.filter(create => {
    return create.protocolDay === 22;
  });
  
  console.log(`Found ${day22Creates.length} creates on Day 22 in cached data\n`);
  
  // Connect to Ethereum with multiple providers for reliability
  const providers = [
    'https://ethereum.publicnode.com',
    'https://eth.llamarpc.com',
    'https://rpc.payload.de'
  ];
  
  let currentProviderIndex = 0;
  let provider = new ethers.providers.JsonRpcProvider(providers[currentProviderIndex]);
  
  console.log('Starting verification of each create...\n');
  
  const results = {
    total: day22Creates.length,
    verified: 0,
    failed: 0,
    durations: {},
    maturityDays: {},
    details: []
  };
  
  // Process each create
  for (let i = 0; i < day22Creates.length; i++) {
    const create = day22Creates[i];
    
    // Show progress
    if (i % 10 === 0) {
      console.log(`Progress: ${i}/${day22Creates.length} (${((i/day22Creates.length)*100).toFixed(1)}%)`);
    }
    
    try {
      // Get transaction
      const tx = await provider.getTransaction(create.transactionHash);
      
      if (!tx) {
        results.failed++;
        results.details.push({
          txHash: create.transactionHash,
          error: 'Transaction not found',
          verified: false
        });
        continue;
      }
      
      // Verify it's to the correct contract
      if (tx.to.toLowerCase() !== CREATE_STAKE_CONTRACT.toLowerCase()) {
        results.failed++;
        results.details.push({
          txHash: create.transactionHash,
          error: `Wrong contract: ${tx.to}`,
          verified: false
        });
        continue;
      }
      
      // Get receipt to verify success
      const receipt = await provider.getTransactionReceipt(create.transactionHash);
      
      if (!receipt || receipt.status !== 1) {
        results.failed++;
        results.details.push({
          txHash: create.transactionHash,
          error: 'Transaction failed',
          verified: false
        });
        continue;
      }
      
      // Calculate duration and maturity day
      const startTime = parseInt(create.timestamp);
      const endTime = parseInt(create.endTime);
      const duration = Math.round((endTime - startTime) / 86400);
      
      const maturityDate = new Date(create.maturityDate);
      const maturityDay = Math.floor((maturityDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      // Track durations and maturity days
      results.durations[duration] = (results.durations[duration] || 0) + 1;
      results.maturityDays[maturityDay] = (results.maturityDays[maturityDay] || 0) + 1;
      
      results.verified++;
      results.details.push({
        txHash: create.transactionHash,
        blockNumber: tx.blockNumber,
        from: tx.from,
        torusAmount: ethers.utils.formatEther(create.torusAmount),
        duration: duration,
        maturityDay: maturityDay,
        verified: true
      });
      
      // Rate limiting to avoid overwhelming the RPC
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Switch provider if we get rate limited
      if (i % 100 === 99) {
        currentProviderIndex = (currentProviderIndex + 1) % providers.length;
        provider = new ethers.providers.JsonRpcProvider(providers[currentProviderIndex]);
        console.log(`Switched to provider: ${providers[currentProviderIndex]}`);
      }
      
    } catch (error) {
      // Try switching provider on error
      if (error.message.includes('rate') || error.message.includes('429')) {
        currentProviderIndex = (currentProviderIndex + 1) % providers.length;
        provider = new ethers.providers.JsonRpcProvider(providers[currentProviderIndex]);
        console.log(`Rate limited, switched to: ${providers[currentProviderIndex]}`);
        i--; // Retry this create
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      results.failed++;
      results.details.push({
        txHash: create.transactionHash,
        error: error.message,
        verified: false
      });
    }
  }
  
  // Display results
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 VERIFICATION COMPLETE');
  console.log('='.repeat(60) + '\n');
  
  console.log(`Total Day 22 Creates: ${results.total}`);
  console.log(`✅ Verified: ${results.verified}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.verified/results.total)*100).toFixed(1)}%\n`);
  
  console.log('📊 Duration Distribution:');
  Object.entries(results.durations)
    .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))
    .forEach(([duration, count]) => {
      console.log(`   ${duration} days: ${count} creates`);
    });
  
  console.log('\n📊 Maturity Day Distribution:');
  Object.entries(results.maturityDays)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([day, count]) => {
      console.log(`   Day ${day}: ${count} creates maturing`);
    });
  
  // Show failed transactions if any
  if (results.failed > 0) {
    console.log('\n❌ Failed Verifications:');
    results.details
      .filter(d => !d.verified)
      .slice(0, 10)
      .forEach(d => {
        console.log(`   ${d.txHash}: ${d.error}`);
      });
    if (results.failed > 10) {
      console.log(`   ... and ${results.failed - 10} more`);
    }
  }
  
  // Save full results
  const outputFile = 'day22-creates-verification.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Full results saved to: ${outputFile}`);
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ SUMMARY:');
  console.log('='.repeat(60));
  console.log(`Day 22 had ${results.total} creates`);
  console.log(`${results.durations[88] || 0} creates have 88-day duration`);
  console.log(`These will mature on Day ${22 + 88} = Day 110`);
  console.log(`Actual Day 110 maturities found: ${results.maturityDays[110] || 0}`);
}

verifyAllDay22Creates().catch(console.error);