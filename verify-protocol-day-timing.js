// Verify on-chain protocol day timing
const { ethers } = require('ethers');

async function verifyProtocolDayTiming() {
  console.log('🔍 VERIFYING ON-CHAIN PROTOCOL DAY TIMING');
  console.log('==========================================');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const ABI = [
    'function getCurrentDayIndex() view returns (uint24)',
    'function protocolStart() view returns (uint256)'
  ];
  
  try {
    const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, ABI, provider);
    
    // Get current block timestamp
    const currentBlock = await provider.getBlock('latest');
    const currentTimestamp = currentBlock.timestamp;
    const currentDate = new Date(currentTimestamp * 1000);
    
    console.log(`\n📅 CURRENT BLOCKCHAIN STATE:`);
    console.log(`  Current block: ${currentBlock.number}`);
    console.log(`  Current timestamp: ${currentTimestamp}`);
    console.log(`  Current UTC time: ${currentDate.toISOString()}`);
    console.log(`  Current date: ${currentDate.toDateString()}`);
    
    // Get protocol start timestamp from contract
    const protocolStartTimestamp = await contract.protocolStart();
    const protocolStartDate = new Date(Number(protocolStartTimestamp) * 1000);
    
    console.log(`\n🚀 PROTOCOL START (FROM CONTRACT):`);
    console.log(`  Protocol start timestamp: ${protocolStartTimestamp}`);
    console.log(`  Protocol start UTC time: ${protocolStartDate.toISOString()}`);
    console.log(`  Protocol start date: ${protocolStartDate.toDateString()}`);
    
    // Get current day index from contract
    const currentDayIndex = await contract.getCurrentDayIndex();
    
    console.log(`\n📊 CONTRACT DAY INDEX:`);
    console.log(`  Current day index: ${currentDayIndex}`);
    
    // Calculate local day calculation
    const secondsSinceStart = currentTimestamp - Number(protocolStartTimestamp);
    const daysSinceStart = Math.floor(secondsSinceStart / 86400);
    
    console.log(`\n🧮 LOCAL CALCULATION:`);
    console.log(`  Seconds since start: ${secondsSinceStart}`);
    console.log(`  Days since start: ${daysSinceStart}`);
    console.log(`  Local calculated day: ${daysSinceStart}`);
    
    // Compare contract vs local calculation
    console.log(`\n⚖️ COMPARISON:`);
    console.log(`  Contract day index: ${currentDayIndex}`);
    console.log(`  Local calculated day: ${daysSinceStart}`);
    console.log(`  Difference: ${Number(currentDayIndex) - daysSinceStart}`);
    
    if (Number(currentDayIndex) === daysSinceStart) {
      console.log(`  ✅ MATCH: Contract and local calculations agree!`);
    } else {
      console.log(`  ❌ MISMATCH: Contract and local calculations differ!`);
    }
    
    // Show exact protocol start details
    console.log(`\n🔍 DETAILED PROTOCOL START INFO:`);
    console.log(`  Start timestamp: ${protocolStartTimestamp} (Unix)`);
    console.log(`  Start date/time: ${protocolStartDate.toISOString()}`);
    console.log(`  Start day of week: ${protocolStartDate.toLocaleDateString('en-US', { weekday: 'long' })}`);
    console.log(`  Start hour UTC: ${protocolStartDate.getUTCHours()}:${protocolStartDate.getUTCMinutes().toString().padStart(2, '0')}`);
    
    // Calculate when the current day started
    const currentDayStart = Number(protocolStartTimestamp) + (Number(currentDayIndex) * 86400);
    const currentDayStartDate = new Date(currentDayStart * 1000);
    
    console.log(`\n📅 CURRENT PROTOCOL DAY ${currentDayIndex}:`);
    console.log(`  Day ${currentDayIndex} started at: ${currentDayStartDate.toISOString()}`);
    console.log(`  Seconds into day ${currentDayIndex}: ${currentTimestamp - currentDayStart}`);
    console.log(`  Hours into day ${currentDayIndex}: ${((currentTimestamp - currentDayStart) / 3600).toFixed(2)}`);
    
    // Calculate when next day starts
    const nextDayStart = currentDayStart + 86400;
    const nextDayStartDate = new Date(nextDayStart * 1000);
    const secondsUntilNextDay = nextDayStart - currentTimestamp;
    
    console.log(`\n⏰ NEXT PROTOCOL DAY (${Number(currentDayIndex) + 1}):`);
    console.log(`  Day ${Number(currentDayIndex) + 1} starts at: ${nextDayStartDate.toISOString()}`);
    console.log(`  Seconds until next day: ${secondsUntilNextDay}`);
    console.log(`  Hours until next day: ${(secondsUntilNextDay / 3600).toFixed(2)}`);
    
    return {
      protocolStartTimestamp: Number(protocolStartTimestamp),
      currentDayIndex: Number(currentDayIndex),
      localCalculatedDay: daysSinceStart,
      isMatch: Number(currentDayIndex) === daysSinceStart,
      currentTimestamp,
      protocolStartDate,
      currentDayStartDate,
      nextDayStartDate
    };
    
  } catch (error) {
    console.error('❌ Error verifying protocol day timing:', error);
    throw error;
  }
}

// Run the verification
verifyProtocolDayTiming()
  .then(result => {
    console.log('\n✅ Protocol day timing verification completed successfully');
    console.log('\nKey findings:');
    console.log(`- Protocol start: ${result.protocolStartDate.toISOString()}`);
    console.log(`- Contract current day: ${result.currentDayIndex}`);
    console.log(`- Local calculated day: ${result.localCalculatedDay}`);
    console.log(`- Match status: ${result.isMatch ? '✅ MATCHING' : '❌ MISMATCH'}`);
  })
  .catch(error => {
    console.error('❌ Failed to verify protocol day timing:', error);
    process.exit(1);
  });