const { ethers } = require('ethers');
const fs = require('fs');

async function verifyDay22WithProgress() {
  console.log('🔍 Verifying ALL Day 22 Creates (with progress saving)\n');
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Filter creates from day 22
  const day22Creates = cachedData.stakingData.createEvents.filter(create => {
    return create.protocolDay === 22;
  });
  
  console.log(`Found ${day22Creates.length} creates on Day 22\n`);
  
  // Initialize or load existing progress
  const progressFile = 'day22-verification-progress.json';
  let progress = {
    total: day22Creates.length,
    completed: 0,
    verified: 0,
    failed: 0,
    durations: {},
    maturityDays: {},
    details: [],
    lastIndex: 0
  };
  
  // Load existing progress if available
  if (fs.existsSync(progressFile)) {
    const existing = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    progress = existing;
    console.log(`Resuming from index ${progress.lastIndex}\n`);
  }
  
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  // Process remaining creates
  for (let i = progress.lastIndex; i < day22Creates.length; i++) {
    const create = day22Creates[i];
    
    try {
      process.stdout.write(`\rVerifying ${i + 1}/${day22Creates.length} (${((i + 1)/day22Creates.length * 100).toFixed(1)}%)...`);
      
      // Get transaction and receipt
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(create.transactionHash),
        provider.getTransactionReceipt(create.transactionHash)
      ]);
      
      if (!tx || !receipt) {
        progress.failed++;
        progress.details.push({
          index: i,
          txHash: create.transactionHash,
          error: 'Transaction not found',
          verified: false
        });
      } else if (tx.to.toLowerCase() !== CREATE_STAKE_CONTRACT.toLowerCase()) {
        progress.failed++;
        progress.details.push({
          index: i,
          txHash: create.transactionHash,
          error: `Wrong contract: ${tx.to}`,
          verified: false
        });
      } else if (receipt.status !== 1) {
        progress.failed++;
        progress.details.push({
          index: i,
          txHash: create.transactionHash,
          error: 'Transaction failed',
          verified: false
        });
      } else {
        // Verified successfully
        const startTime = parseInt(create.timestamp);
        const endTime = parseInt(create.endTime);
        const duration = Math.round((endTime - startTime) / 86400);
        
        const maturityDate = new Date(create.maturityDate);
        const maturityDay = Math.floor((maturityDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        
        progress.durations[duration] = (progress.durations[duration] || 0) + 1;
        progress.maturityDays[maturityDay] = (progress.maturityDays[maturityDay] || 0) + 1;
        
        progress.verified++;
        progress.details.push({
          index: i,
          txHash: create.transactionHash,
          blockNumber: tx.blockNumber,
          from: tx.from,
          torusAmount: ethers.utils.formatEther(create.torusAmount),
          duration: duration,
          maturityDay: maturityDay,
          verified: true
        });
      }
      
      progress.completed++;
      progress.lastIndex = i + 1;
      
      // Save progress every 10 creates
      if (i % 10 === 0) {
        fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`\nError at index ${i}: ${error.message}`);
      progress.failed++;
      progress.details.push({
        index: i,
        txHash: create.transactionHash,
        error: error.message,
        verified: false
      });
      
      // Save progress on error
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
      
      // Wait longer on rate limit errors
      if (error.message.includes('rate') || error.message.includes('429')) {
        console.log('Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  // Save final progress
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  
  // Display final results
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 VERIFICATION COMPLETE');
  console.log('='.repeat(60) + '\n');
  
  console.log(`Total Day 22 Creates: ${progress.total}`);
  console.log(`✅ Verified: ${progress.verified}`);
  console.log(`❌ Failed: ${progress.failed}`);
  console.log(`Success Rate: ${((progress.verified/progress.completed)*100).toFixed(1)}%\n`);
  
  console.log('📊 Duration Distribution:');
  Object.entries(progress.durations)
    .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))
    .forEach(([duration, count]) => {
      console.log(`   ${duration} days: ${count} creates`);
    });
  
  console.log('\n📊 Maturity Day Distribution:');
  Object.entries(progress.maturityDays)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([day, count]) => {
      console.log(`   Day ${day}: ${count} creates maturing`);
    });
  
  console.log('\n✅ KEY FINDING:');
  console.log(`   88-day creates: ${progress.durations[88] || 0}`);
  console.log(`   Day 110 maturities: ${progress.maturityDays[110] || 0}`);
  console.log(`   Match: ${(progress.durations[88] || 0) === (progress.maturityDays[110] || 0) ? 'YES ✅' : 'NO ❌'}`);
  
  // Save final report
  const reportFile = 'day22-verification-report.json';
  fs.writeFileSync(reportFile, JSON.stringify({
    summary: {
      totalDay22Creates: progress.total,
      verified: progress.verified,
      failed: progress.failed,
      successRate: ((progress.verified/progress.completed)*100).toFixed(1) + '%',
      creates88Days: progress.durations[88] || 0,
      maturesDay110: progress.maturityDays[110] || 0
    },
    durations: progress.durations,
    maturityDays: progress.maturityDays,
    verificationTime: new Date().toISOString()
  }, null, 2));
  
  console.log(`\n💾 Final report saved to: ${reportFile}`);
}

verifyDay22WithProgress().catch(console.error);