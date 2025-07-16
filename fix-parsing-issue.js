// Fix the blockchain data parsing issues
const fs = require('fs');
const { ethers } = require('ethers');

async function testEventParsing() {
  console.log('🔍 Testing event parsing to identify stakingDays issue...');
  
  const RPC_ENDPOINTS = [
    'https://ethereum.publicnode.com',
    'https://1rpc.io/eth',
    'https://eth.llamarpc.com',
    'https://eth-mainnet.public.blastapi.io',
  ];
  
  const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
  const TORUS_CREATE_STAKE = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // CORRECT ABI based on Etherscan analysis
  const CORRECT_ABI = [
    'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
    'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)',
    'function getUserInfo(address user, uint256 stakeIndex) view returns (tuple(uint256 principal, uint256 shares, uint256 stakingDays, uint256 startTime, uint256 endTime, bool claimedStake, bool claimedCreate, uint256 power, uint256 costETH, uint256 costTitanX, uint256 torusAmount) userInfo)'
  ];
  
  const contract = new ethers.Contract(TORUS_CREATE_STAKE, CORRECT_ABI, provider);
  
  console.log('📡 Connected to contract...');
  
  // Test with just a few recent events
  const currentBlock = await provider.getBlockNumber();
  const deploymentBlock = 22890272;
  
  // Get one recent Staked event
  console.log('🔍 Testing Staked event parsing...');
  const stakeFilter = contract.filters.Staked();
  const stakeEvents = await contract.queryFilter(stakeFilter, currentBlock - 1000, currentBlock);
  
  if (stakeEvents.length > 0) {
    const event = stakeEvents[0];
    const args = event.args;
    console.log('Raw Staked event data:');
    console.log('  user:', args.user);
    console.log('  stakeIndex:', args.stakeIndex.toString());
    console.log('  principal:', ethers.utils.formatEther(args.principal), 'TORUS');
    console.log('  stakingDays:', args.stakingDays.toString());
    console.log('  shares:', args.shares.toString());
    
    // Verify stakingDays is reasonable
    const days = Number(args.stakingDays);
    console.log('  stakingDays as number:', days);
    console.log('  Is reasonable (1-88):', days >= 1 && days <= 88);
  }
  
  // Test with one Created event  
  console.log('\n🔍 Testing Created event parsing...');
  const createFilter = contract.filters.Created();
  const createEvents = await contract.queryFilter(createFilter, currentBlock - 1000, currentBlock);
  
  if (createEvents.length > 0) {
    const event = createEvents[0];
    const args = event.args;
    const block = await provider.getBlock(event.blockNumber);
    
    console.log('Raw Created event data:');
    console.log('  user:', args.user);
    console.log('  stakeIndex:', args.stakeIndex.toString());
    console.log('  torusAmount:', ethers.utils.formatEther(args.torusAmount), 'TORUS');
    console.log('  endTime:', args.endTime.toString());
    
    // Calculate stakingDays from timestamps
    const startTime = block.timestamp;
    const endTime = Number(args.endTime);
    const stakingDays = Math.round((endTime - startTime) / 86400);
    
    console.log('  startTime (block):', startTime, new Date(startTime * 1000).toISOString());
    console.log('  endTime (event):', endTime, new Date(endTime * 1000).toISOString());
    console.log('  calculated stakingDays:', stakingDays);
    console.log('  Is reasonable (1-88):', stakingDays >= 1 && stakingDays <= 88);
  }
  
  console.log('\n✅ Event parsing test complete!');
}

// Run the test
testEventParsing().catch(console.error);