const { ethers } = require('ethers');

const CONTRACTS = {
  CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
};

const STAKE_ABI = [
  "event Staked(address indexed user, uint256 indexed stakeIndex, uint256 principal, uint256 shares, uint256 stakingDays, uint256 startTime)",
];

const RPC_URLS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
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
  const contract = new ethers.Contract(CONTRACTS.CREATE_STAKE, STAKE_ABI, provider);
  
  console.log('Fetching Staked events from blockchain...');
  
  // Get deployment block from Etherscan data
  const startBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  console.log(`Scanning blocks ${startBlock} to ${currentBlock}`);
  
  let allEvents = [];
  const chunkSize = 5000;
  
  for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    console.log(`Fetching blocks ${fromBlock}-${toBlock}...`);
    
    try {
      const events = await contract.queryFilter(
        contract.filters.Staked(),
        fromBlock,
        toBlock
      );
      allEvents = allEvents.concat(events);
      console.log(`  Found ${events.length} events`);
    } catch (e) {
      console.error(`Error fetching chunk: ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\nTotal Staked events found: ${allEvents.length}`);
  
  // Calculate total from on-chain data
  let totalStakedWei = ethers.BigNumber.from(0);
  const stakesMap = new Map();
  
  for (const event of allEvents) {
    const principal = event.args.principal;
    totalStakedWei = totalStakedWei.add(principal);
    
    const key = `${event.args.user}-${event.args.stakeIndex}`;
    if (stakesMap.has(key)) {
      console.log(`WARNING: Duplicate stake found: ${key}`);
    }
    stakesMap.set(key, {
      principal: principal.toString(),
      shares: event.args.shares.toString(),
      duration: event.args.stakingDays.toString(),
      block: event.blockNumber,
      txHash: event.transactionHash
    });
  }
  
  const totalStakedTorus = ethers.utils.formatEther(totalStakedWei);
  console.log(`\n✅ TOTAL TORUS STAKED (from blockchain): ${totalStakedTorus} TORUS`);
  
  // Compare with our JSON data
  const fs = require('fs');
  const jsonData = JSON.parse(fs.readFileSync('public/data/cached-data-complete.json'));
  const jsonStakes = jsonData.stakingData.stakeEvents;
  
  console.log(`\n📊 JSON data has ${jsonStakes.length} stake events`);
  
  let jsonTotalWei = ethers.BigNumber.from(0);
  for (const stake of jsonStakes) {
    jsonTotalWei = jsonTotalWei.add(stake.principal);
  }
  const jsonTotalTorus = ethers.utils.formatEther(jsonTotalWei);
  console.log(`📊 JSON total: ${jsonTotalTorus} TORUS`);
  
  // Check for missing or extra events
  console.log('\nChecking for discrepancies...');
  
  // Convert JSON stakes to map for comparison
  const jsonMap = new Map();
  for (const stake of jsonStakes) {
    const key = `${stake.user}-${stake.id}`;
    jsonMap.set(key, stake);
  }
  
  // Find missing from JSON
  let missing = 0;
  for (const [key, onchainStake] of stakesMap) {
    if (!jsonMap.has(key)) {
      console.log(`Missing from JSON: ${key}`);
      missing++;
    }
  }
  
  // Find extra in JSON
  let extra = 0;
  for (const [key, jsonStake] of jsonMap) {
    if (!stakesMap.has(key)) {
      console.log(`Extra in JSON (not on chain): ${key}`);
      extra++;
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`- On-chain events: ${allEvents.length}`);
  console.log(`- JSON events: ${jsonStakes.length}`);
  console.log(`- Missing from JSON: ${missing}`);
  console.log(`- Extra in JSON: ${extra}`);
  console.log(`- On-chain total: ${totalStakedTorus} TORUS`);
  console.log(`- JSON total: ${jsonTotalTorus} TORUS`);
  console.log(`- Difference: ${(parseFloat(totalStakedTorus) - parseFloat(jsonTotalTorus)).toFixed(6)} TORUS`);
}

verifyStakeTotals().catch(console.error);