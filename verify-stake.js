const { ethers } = require('ethers');

// RPC endpoint
const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');

// Contract addresses and ABI
const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

// Minimal ABI for reading stake data
const CREATE_STAKE_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}, {"internalType": "uint256", "name": "id", "type": "uint256"}],
    "name": "stakeTorus",
    "outputs": [
      {"internalType": "uint256", "name": "principal", "type": "uint256"},
      {"internalType": "uint256", "name": "power", "type": "uint256"},
      {"internalType": "uint256", "name": "stakingDays", "type": "uint256"},
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint256", "name": "startDayIndex", "type": "uint256"},
      {"internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"internalType": "uint256", "name": "shares", "type": "uint256"},
      {"internalType": "bool", "name": "claimedCreate", "type": "bool"},
      {"internalType": "bool", "name": "claimedStake", "type": "bool"},
      {"internalType": "uint256", "name": "costTitanX", "type": "uint256"},
      {"internalType": "uint256", "name": "costETH", "type": "uint256"},
      {"internalType": "uint256", "name": "rewards", "type": "uint256"},
      {"internalType": "uint256", "name": "penalties", "type": "uint256"},
      {"internalType": "uint256", "name": "claimedAt", "type": "uint256"},
      {"internalType": "bool", "name": "isCreate", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
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

async function verifyStake() {
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, CREATE_STAKE_ABI, provider);
  
  // The suspicious stake details from cached data
  const user = '0xB7d0C3CA1CD15421f5786a9C1e420Ad074f79781';
  const stakeId = 33; // Based on the cached data, this should be stake ID 33
  const expectedPrincipal = '1000000000000000000'; // 1 TORUS
  const expectedTimestamp = 1753287827;
  
  console.log('Verifying stake on-chain...');
  console.log('User:', user);
  console.log('Expected principal:', expectedPrincipal, '(1 TORUS)');
  console.log('Expected timestamp:', expectedTimestamp, new Date(expectedTimestamp * 1000).toISOString());
  
  try {
    // Get the stake data directly from the contract
    const stakeData = await contract.stakeTorus(user, stakeId);
    
    console.log('\nOn-chain stake data:');
    console.log('Principal:', stakeData.principal.toString());
    console.log('Principal in TORUS:', ethers.utils.formatEther(stakeData.principal));
    console.log('Staking days:', stakeData.stakingDays.toString());
    console.log('Start time:', stakeData.startTime.toString());
    console.log('Start date:', new Date(stakeData.startTime.toNumber() * 1000).toISOString());
    console.log('Shares:', stakeData.shares.toString());
    console.log('Is Create:', stakeData.isCreate);
    
    // Verify if it matches
    const principalMatches = stakeData.principal.toString() === expectedPrincipal;
    const timestampMatches = stakeData.startTime.toNumber() === expectedTimestamp;
    
    console.log('\nVerification:');
    console.log('Principal matches:', principalMatches);
    console.log('Timestamp matches:', timestampMatches);
    
    if (principalMatches && timestampMatches) {
      console.log('\n✅ VERIFIED: This 1 TORUS stake is legitimate and exists on-chain!');
    } else {
      console.log('\n❌ MISMATCH: The on-chain data differs from cached data');
    }
    
    // Also check via events to double-verify
    console.log('\nDouble-checking via events...');
    const filter = contract.filters.StakeStarted(user);
    const events = await contract.queryFilter(filter, 22980000, 'latest');
    
    const matchingEvent = events.find(e => 
      e.args.principal.toString() === expectedPrincipal &&
      e.args.id.toNumber() === stakeId
    );
    
    if (matchingEvent) {
      console.log('✅ Found matching StakeStarted event:');
      console.log('  Block:', matchingEvent.blockNumber);
      console.log('  Transaction:', matchingEvent.transactionHash);
      console.log('  Principal:', ethers.utils.formatEther(matchingEvent.args.principal), 'TORUS');
      console.log('  Shares:', matchingEvent.args.shares.toString());
      console.log('  Duration:', matchingEvent.args.duration.toString(), 'days');
    }
    
  } catch (error) {
    console.error('Error verifying stake:', error.message);
    
    // Try to get user's stake count to find the right ID
    try {
      console.log('\nTrying to find all stakes for this user...');
      // Use a smaller block range - around the expected timestamp
      // Block 22980000 is approximately July 22, 2025
      const filter = contract.filters.StakeStarted(user);
      const events = await contract.queryFilter(filter, 22980000, 22983000);
      
      console.log(`Found ${events.length} stakes for user ${user}:`);
      for (const event of events) {
        const block = await provider.getBlock(event.blockNumber);
        console.log(`  Stake ID ${event.args.id}: ${ethers.utils.formatEther(event.args.principal)} TORUS at ${new Date(block.timestamp * 1000).toISOString()}`);
      }
    } catch (err) {
      console.error('Error getting user stakes:', err.message);
    }
  }
}

verifyStake().catch(console.error);