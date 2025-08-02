const { ethers } = require('ethers');
const fs = require('fs');

async function verifyDay22Complete() {
  console.log('🔍 Verifying ALL Day 22 Creates (including those without txHash)\n');
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const CREATE_STAKE_ABI = [
    "event CreateStarted(address indexed user, uint256 indexed createId, uint256 torusAmount, uint256 titanAmount, uint256 ethAmount, uint256 stakingDays)"
  ];
  
  // Filter creates from day 22
  const day22Creates = cachedData.stakingData.createEvents.filter(create => {
    return create.protocolDay === 22;
  });
  
  console.log(`Found ${day22Creates.length} creates on Day 22`);
  console.log(`With txHash: ${day22Creates.filter(c => c.transactionHash).length}`);
  console.log(`Without txHash: ${day22Creates.filter(c => !c.transactionHash).length}\n`);
  
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, CREATE_STAKE_ABI, provider);
  
  let verified = 0;
  let failed = 0;
  let durations = {};
  let maturityDays = {};
  let details = [];
  
  // For creates without txHash, we'll verify by block number and event logs
  for (let i = 0; i < day22Creates.length; i++) {
    const create = day22Creates[i];
    
    try {
      process.stdout.write(`\rVerifying ${i + 1}/${day22Creates.length} (${((i + 1)/day22Creates.length * 100).toFixed(1)}%)...`);
      
      let isVerified = false;
      
      if (create.transactionHash) {
        // Original verification method
        const [tx, receipt] = await Promise.all([
          provider.getTransaction(create.transactionHash),
          provider.getTransactionReceipt(create.transactionHash)
        ]);
        
        if (tx && receipt && 
            tx.to.toLowerCase() === CREATE_STAKE_CONTRACT.toLowerCase() && 
            receipt.status === 1) {
          isVerified = true;
        }
      } else if (create.blockNumber) {
        // Verify by checking CreateStarted events in the block
        const filter = contract.filters.CreateStarted(create.user, create.createId);
        const events = await contract.queryFilter(filter, create.blockNumber, create.blockNumber);
        
        if (events.length > 0) {
          // Found matching event
          const event = events[0];
          if (event.args.torusAmount.toString() === create.torusAmount &&
              event.args.stakingDays.toString() === create.stakingDays.toString()) {
            isVerified = true;
          }
        }
      }
      
      if (isVerified) {
        const startTime = parseInt(create.timestamp);
        const endTime = parseInt(create.endTime);
        const duration = Math.round((endTime - startTime) / 86400);
        
        const maturityDate = new Date(create.maturityDate);
        const maturityDay = Math.floor((maturityDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        
        durations[duration] = (durations[duration] || 0) + 1;
        maturityDays[maturityDay] = (maturityDays[maturityDay] || 0) + 1;
        
        verified++;
        details.push({
          index: i,
          createId: create.createId || create.id,
          blockNumber: create.blockNumber,
          user: create.user,
          torusAmount: ethers.utils.formatEther(create.torusAmount),
          duration: duration,
          maturityDay: maturityDay,
          verified: true
        });
      } else {
        failed++;
        details.push({
          index: i,
          createId: create.createId || create.id,
          error: create.transactionHash ? 'Transaction verification failed' : 'Event verification failed',
          verified: false
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      failed++;
      details.push({
        index: i,
        createId: create.createId || create.id,
        error: error.message,
        verified: false
      });
      
      // Wait longer on rate limit errors
      if (error.message.includes('rate') || error.message.includes('429')) {
        console.log('\nRate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  // Display final results
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 VERIFICATION COMPLETE');
  console.log('='.repeat(60) + '\n');
  
  console.log(`Total Day 22 Creates: ${day22Creates.length}`);
  console.log(`✅ Verified: ${verified}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((verified/day22Creates.length)*100).toFixed(1)}%\n`);
  
  console.log('📊 Duration Distribution:');
  Object.entries(durations)
    .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))
    .forEach(([duration, count]) => {
      console.log(`   ${duration} days: ${count} creates`);
    });
  
  console.log('\n📊 Maturity Day Distribution:');
  Object.entries(maturityDays)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([day, count]) => {
      console.log(`   Day ${day}: ${count} creates maturing`);
    });
  
  console.log('\n✅ KEY FINDING:');
  console.log(`   88-day creates: ${durations[88] || 0}`);
  console.log(`   Day 110 maturities: ${maturityDays[110] || 0}`);
  console.log(`   Match: ${(durations[88] || 0) === (maturityDays[110] || 0) ? 'YES ✅' : 'NO ❌'}`);
  
  // Save final report
  const reportFile = 'day22-complete-verification-report.json';
  fs.writeFileSync(reportFile, JSON.stringify({
    summary: {
      totalDay22Creates: day22Creates.length,
      verified: verified,
      failed: failed,
      successRate: ((verified/day22Creates.length)*100).toFixed(1) + '%',
      creates88Days: durations[88] || 0,
      maturesDay110: maturityDays[110] || 0
    },
    durations: durations,
    maturityDays: maturityDays,
    verificationTime: new Date().toISOString()
  }, null, 2));
  
  console.log(`\n💾 Final report saved to: ${reportFile}`);
}

verifyDay22Complete().catch(console.error);