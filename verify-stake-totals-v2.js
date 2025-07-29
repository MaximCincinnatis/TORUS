const { ethers } = require('ethers');
const fs = require('fs');

const CONTRACTS = {
  CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
};

const STAKE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "stakeIndex",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "principal",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "stakingDays",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      }
    ],
    "name": "Staked",
    "type": "event"
  }
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
  
  // Get deployment block
  const startBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  console.log(`Scanning blocks ${startBlock} to ${currentBlock}`);
  
  // Try a direct query first to test
  console.log('\nTesting event query...');
  try {
    const testEvents = await contract.queryFilter(
      contract.filters.Staked(),
      currentBlock - 1000,
      currentBlock
    );
    console.log(`Test query found ${testEvents.length} events in last 1000 blocks`);
    if (testEvents.length > 0) {
      console.log('Sample event:', testEvents[0]);
    }
  } catch (e) {
    console.error('Test query failed:', e.message);
  }
  
  // Now do the full scan
  let allEvents = [];
  const chunkSize = 2000; // Smaller chunks
  
  for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    console.log(`Fetching blocks ${fromBlock}-${toBlock}...`);
    
    try {
      const events = await contract.queryFilter(
        contract.filters.Staked(),
        fromBlock,
        toBlock
      );
      if (events.length > 0) {
        console.log(`  ✅ Found ${events.length} events`);
        allEvents = allEvents.concat(events);
      }
    } catch (e) {
      console.error(`  ❌ Error: ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\nTotal Staked events found: ${allEvents.length}`);
  
  if (allEvents.length === 0) {
    console.log('\n⚠️  No events found. Checking contract directly...');
    
    // Try reading logs directly
    try {
      const logs = await provider.getLogs({
        address: CONTRACTS.CREATE_STAKE,
        fromBlock: startBlock,
        toBlock: startBlock + 10000,
        topics: [ethers.utils.id("Staked(address,uint256,uint256,uint256,uint256,uint256)")]
      });
      console.log(`Direct log query found ${logs.length} logs`);
    } catch (e) {
      console.error('Direct log query failed:', e.message);
    }
    
    return;
  }
  
  // Calculate total
  let totalStakedWei = ethers.BigNumber.from(0);
  
  for (const event of allEvents) {
    const principal = event.args.principal;
    totalStakedWei = totalStakedWei.add(principal);
  }
  
  const totalStakedTorus = ethers.utils.formatEther(totalStakedWei);
  console.log(`\n✅ TOTAL TORUS STAKED (from blockchain): ${totalStakedTorus} TORUS`);
  
  // Compare with JSON
  const jsonData = JSON.parse(fs.readFileSync('public/data/cached-data-complete.json'));
  const jsonStakes = jsonData.stakingData.stakeEvents;
  
  let jsonTotalWei = ethers.BigNumber.from(0);
  for (const stake of jsonStakes) {
    jsonTotalWei = jsonTotalWei.add(stake.principal);
  }
  const jsonTotalTorus = ethers.utils.formatEther(jsonTotalWei);
  
  console.log(`\n📊 Comparison:`);
  console.log(`- On-chain total: ${totalStakedTorus} TORUS (${allEvents.length} events)`);
  console.log(`- JSON total: ${jsonTotalTorus} TORUS (${jsonStakes.length} events)`);
  console.log(`- Difference: ${(parseFloat(totalStakedTorus) - parseFloat(jsonTotalTorus)).toFixed(6)} TORUS`);
}

verifyStakeTotals().catch(console.error);