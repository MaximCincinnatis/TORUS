const { ethers } = require('ethers');
const fs = require('fs');

const CONTRACTS = {
  CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
};

// Use the exact same ABI as our working scripts
const CREATE_STAKE_ABI = [
  'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 shares, uint256 stakingDays)',
];

const RPC_URLS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth-mainnet.public.blastapi.io'
];

async function getProvider() {
  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      console.log(`Connected to: ${url}`);
      return provider;
    } catch (e) {
      console.log(`Failed ${url}: ${e.message}`);
    }
  }
  throw new Error('No working RPC');
}

async function verifyStakeTotals() {
  const provider = await getProvider();
  const contract = new ethers.Contract(CONTRACTS.CREATE_STAKE, CREATE_STAKE_ABI, provider);
  
  console.log('🔍 Fetching Staked events from blockchain...\n');
  
  // Get deployment block
  const deploymentBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  console.log(`📊 Scanning blocks ${deploymentBlock} to ${currentBlock}`);
  console.log(`📊 Block range: ${currentBlock - deploymentBlock} blocks\n`);
  
  // Fetch all events
  let allEvents = [];
  const chunkSize = 5000;
  
  for (let fromBlock = deploymentBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    process.stdout.write(`\r⏳ Progress: ${Math.floor((fromBlock - deploymentBlock) / (currentBlock - deploymentBlock) * 100)}%`);
    
    try {
      const filter = contract.filters.Staked();
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      
      if (events.length > 0) {
        allEvents = allEvents.concat(events);
      }
    } catch (e) {
      console.error(`\n❌ Error at blocks ${fromBlock}-${toBlock}: ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n\n✅ Total Staked events found: ${allEvents.length}`);
  
  // Calculate total from blockchain
  let totalStakedWei = ethers.BigNumber.from(0);
  const eventDetails = [];
  
  for (const event of allEvents) {
    const principal = event.args.principal;
    const user = event.args.user;
    const stakeIndex = event.args.stakeIndex.toString();
    
    totalStakedWei = totalStakedWei.add(principal);
    
    eventDetails.push({
      user,
      stakeIndex,
      principal: principal.toString(),
      principalTorus: ethers.utils.formatEther(principal),
      block: event.blockNumber,
      txHash: event.transactionHash
    });
  }
  
  const totalStakedTorus = ethers.utils.formatEther(totalStakedWei);
  console.log(`\n💰 TOTAL TORUS STAKED (from blockchain): ${parseFloat(totalStakedTorus).toLocaleString()} TORUS`);
  
  // Show first few events as verification
  console.log('\n📋 First 5 stake events from blockchain:');
  eventDetails.slice(0, 5).forEach((e, i) => {
    console.log(`  ${i+1}. User ${e.user.slice(0,6)}...${e.user.slice(-4)} staked ${parseFloat(e.principalTorus).toFixed(2)} TORUS`);
  });
  
  // Compare with JSON data
  console.log('\n📊 Comparing with cached JSON data...');
  const jsonData = JSON.parse(fs.readFileSync('public/data/cached-data-complete.json'));
  const jsonStakes = jsonData.stakingData.stakeEvents;
  
  let jsonTotalWei = ethers.BigNumber.from(0);
  for (const stake of jsonStakes) {
    jsonTotalWei = jsonTotalWei.add(stake.principal);
  }
  const jsonTotalTorus = ethers.utils.formatEther(jsonTotalWei);
  
  console.log(`\n📈 Comparison Results:`);
  console.log(`  Blockchain: ${parseFloat(totalStakedTorus).toLocaleString()} TORUS (${allEvents.length} events)`);
  console.log(`  JSON Cache: ${parseFloat(jsonTotalTorus).toLocaleString()} TORUS (${jsonStakes.length} events)`);
  console.log(`  Difference: ${(parseFloat(totalStakedTorus) - parseFloat(jsonTotalTorus)).toFixed(6)} TORUS`);
  
  if (Math.abs(parseFloat(totalStakedTorus) - parseFloat(jsonTotalTorus)) < 0.01) {
    console.log('\n✅ Data is accurate! The totals match.');
  } else {
    console.log('\n⚠️  Data mismatch detected!');
    
    // Check for missing events
    const jsonMap = new Map();
    jsonStakes.forEach(s => jsonMap.set(`${s.user}-${s.id}`, s));
    
    const blockchainMap = new Map();
    eventDetails.forEach(e => blockchainMap.set(`${e.user}-${e.stakeIndex}`, e));
    
    let missing = 0;
    for (const [key, value] of blockchainMap) {
      if (!jsonMap.has(key)) {
        console.log(`  Missing from JSON: ${key}`);
        missing++;
      }
    }
    
    let extra = 0;
    for (const [key, value] of jsonMap) {
      if (!blockchainMap.has(key)) {
        console.log(`  Extra in JSON: ${key}`);
        extra++;
      }
    }
    
    console.log(`\n  Missing from JSON: ${missing} events`);
    console.log(`  Extra in JSON: ${extra} events`);
  }
}

verifyStakeTotals().catch(console.error);