const { ethers } = require('ethers');

// RPC endpoint
const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');

// Contract addresses and ABI
const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

// Minimal ABI for events
const CREATE_STAKE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "id", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "principal", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "duration", "type": "uint256"}
    ],
    "name": "StakeStarted",
    "type": "event"
  }
];

async function verifyDay13Stakes() {
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, CREATE_STAKE_ABI, provider);
  
  // Day 13 is July 22 19:44:11 to July 23 19:44:11
  const day13Start = 1753213451;
  const day13End = 1753299851;
  
  console.log('Checking all stakes on Day 13...');
  console.log('Day 13 range:', new Date(day13Start * 1000).toISOString(), 'to', new Date(day13End * 1000).toISOString());
  
  try {
    // Get all StakeStarted events in a smaller range
    // Block 22980000 is around July 22
    // Block 22983000 is around July 23
    const filter = contract.filters.StakeStarted();
    const events = await contract.queryFilter(filter, 22982000, 22984000);
    
    console.log(`\nFound ${events.length} total stakes in block range 22980000-22983000`);
    
    // Filter for day 13
    const day13Stakes = [];
    
    for (const event of events) {
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block.timestamp;
      
      if (timestamp >= day13Start && timestamp < day13End) {
        day13Stakes.push({
          user: event.args.user,
          id: event.args.id.toNumber(),
          principal: ethers.utils.formatEther(event.args.principal),
          shares: event.args.shares.toString(),
          duration: event.args.duration.toString(),
          timestamp: timestamp,
          date: new Date(timestamp * 1000).toISOString(),
          blockNumber: event.blockNumber,
          txHash: event.transactionHash
        });
      }
    }
    
    console.log(`\nDay 13 stakes: ${day13Stakes.length}`);
    
    let totalStaked = 0;
    for (const stake of day13Stakes) {
      console.log(`\nStake #${stake.id}:`);
      console.log('  User:', stake.user);
      console.log('  Principal:', stake.principal, 'TORUS');
      console.log('  Duration:', stake.duration, 'days');
      console.log('  Timestamp:', stake.timestamp, '(' + stake.date + ')');
      console.log('  Block:', stake.blockNumber);
      console.log('  TX:', stake.txHash);
      
      totalStaked += parseFloat(stake.principal);
    }
    
    console.log('\nTotal staked on Day 13:', totalStaked.toFixed(2), 'TORUS');
    
    // Check if the suspicious 1 TORUS stake exists
    const oneTorusStake = day13Stakes.find(s => 
      s.user.toLowerCase() === '0xB7d0C3CA1CD15421f5786a9C1e420Ad074f79781'.toLowerCase() &&
      Math.abs(parseFloat(s.principal) - 1) < 0.01
    );
    
    if (oneTorusStake) {
      console.log('\n✅ Found the 1 TORUS stake!');
    } else {
      console.log('\n❌ The 1 TORUS stake for user 0xB7d0C3CA1CD15421f5786a9C1e420Ad074f79781 was NOT found on-chain');
      
      // Check if this user has any stakes at all
      const userStakes = day13Stakes.filter(s => 
        s.user.toLowerCase() === '0xB7d0C3CA1CD15421f5786a9C1e420Ad074f79781'.toLowerCase()
      );
      
      if (userStakes.length > 0) {
        console.log('But this user has other stakes on Day 13:', userStakes);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyDay13Stakes().catch(console.error);