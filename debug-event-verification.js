const { ethers } = require('ethers');
const fs = require('fs');

async function debugEventVerification() {
  console.log('🔍 Debugging event verification for creates without txHash\n');
  
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const CREATE_STAKE_ABI = [
    "event CreateStarted(address indexed user, uint256 indexed createId, uint256 torusAmount, uint256 titanAmount, uint256 ethAmount, uint256 stakingDays)"
  ];
  
  const day22Creates = cachedData.stakingData.createEvents.filter(create => {
    return create.protocolDay === 22 && !create.transactionHash;
  });
  
  console.log(`Testing first 3 creates without txHash:`);
  
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, CREATE_STAKE_ABI, provider);
  
  for (let i = 0; i < Math.min(3, day22Creates.length); i++) {
    const create = day22Creates[i];
    console.log(`\nCreate ${i + 1}:`);
    console.log(`  ID: ${create.createId || create.id}`);
    console.log(`  User: ${create.user}`);
    console.log(`  Block: ${create.blockNumber}`);
    console.log(`  Amount: ${create.torusAmount}`);
    console.log(`  Days: ${create.stakingDays}`);
    
    try {
      // Try to get all CreateStarted events in that block
      const filter = contract.filters.CreateStarted();
      const events = await contract.queryFilter(filter, create.blockNumber, create.blockNumber);
      
      console.log(`  Total CreateStarted events in block: ${events.length}`);
      
      // Find matching event
      let found = false;
      for (const event of events) {
        if (event.args.user.toLowerCase() === create.user.toLowerCase() &&
            event.args.createId.toString() === (create.createId || create.id)) {
          console.log(`  ✅ Found matching event!`);
          console.log(`     Event ID: ${event.args.createId.toString()}`);
          console.log(`     Event Amount: ${event.args.torusAmount.toString()}`);
          console.log(`     Match Amount: ${event.args.torusAmount.toString() === create.torusAmount}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`  ❌ No matching event found`);
        
        // Show all events in the block for debugging
        console.log(`  All events in block:`);
        events.slice(0, 3).forEach((event, idx) => {
          console.log(`    Event ${idx + 1}: User=${event.args.user}, ID=${event.args.createId.toString()}`);
        });
      }
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

debugEventVerification().catch(console.error);