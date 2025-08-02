const { ethers } = require('ethers');
const fs = require('fs');

async function verifyDay110Creates() {
  console.log('🔍 Verifying Day 110 Creates On-Chain\n');
  
  // Load cached data to get the creates we need to verify
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  // Contract addresses
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  
  // Filter creates ending on day 110
  const day110Creates = cachedData.stakingData.createEvents.filter(create => {
    const maturityDate = new Date(create.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    return maturityDay === 110;
  });
  
  console.log(`Found ${day110Creates.length} creates ending on day 110 in cached data\n`);
  
  // Connect to Ethereum
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  // Get contract ABI for Created event
  const contractABI = [
    'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
  
  // Verify a sample of these creates on-chain
  console.log('Verifying sample creates on-chain:\n');
  
  // Take first 5 creates as a sample
  const sampleCreates = day110Creates.slice(0, 5);
  
  for (const create of sampleCreates) {
    try {
      // Get the transaction receipt
      const receipt = await provider.getTransactionReceipt(create.transactionHash);
      
      if (!receipt) {
        console.log(`❌ Transaction ${create.transactionHash} not found`);
        continue;
      }
      
      // Parse logs to find Created event
      const logs = receipt.logs;
      let foundCreate = false;
      
      for (const log of logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed.name === 'Created') {
            const endTime = parsed.args.endTime.toNumber();
            const endDate = new Date(endTime * 1000);
            const createDay = Math.floor((endDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            
            console.log(`✅ Verified Create:`);
            console.log(`   User: ${parsed.args.user}`);
            console.log(`   Stake Index: ${parsed.args.stakeIndex.toString()}`);
            console.log(`   TORUS Amount: ${ethers.utils.formatEther(parsed.args.torusAmount)} TORUS`);
            console.log(`   End Time: ${endTime} (${endDate.toISOString()})`);
            console.log(`   Maturity Day: ${createDay}`);
            console.log(`   TX: ${create.transactionHash}`);
            console.log(`   Block: ${receipt.blockNumber}\n`);
            
            foundCreate = true;
            break;
          }
        } catch (e) {
          // Not a Created event, continue
        }
      }
      
      if (!foundCreate) {
        console.log(`⚠️  No Created event found in tx ${create.transactionHash}\n`);
      }
      
    } catch (error) {
      console.log(`❌ Error verifying ${create.transactionHash}: ${error.message}\n`);
    }
  }
  
  // Now let's query the blockchain directly for day 22 creates
  console.log('\n📊 Querying blockchain for Day 22 creates (which mature on Day 110):\n');
  
  // Calculate day 22 timestamp range
  const day22Start = new Date(CONTRACT_START_DATE);
  day22Start.setDate(day22Start.getDate() + 21); // Day 22 is 21 days after day 1
  const day22End = new Date(day22Start);
  day22End.setDate(day22End.getDate() + 1);
  
  console.log(`Day 22 range: ${day22Start.toISOString()} to ${day22End.toISOString()}`);
  
  // Convert to block numbers (approximate)
  const day22StartTimestamp = Math.floor(day22Start.getTime() / 1000);
  const day22EndTimestamp = Math.floor(day22End.getTime() / 1000);
  
  // Get approximate blocks for day 22
  const currentBlock = await provider.getBlockNumber();
  const currentBlockData = await provider.getBlock(currentBlock);
  const secondsPerBlock = 12; // Ethereum average
  const blocksBack = Math.floor((currentBlockData.timestamp - day22StartTimestamp) / secondsPerBlock);
  const startBlock = currentBlock - blocksBack;
  const endBlock = startBlock + Math.floor(86400 / secondsPerBlock); // 24 hours worth of blocks
  
  console.log(`Estimated block range for Day 22: ${startBlock} to ${endBlock}`);
  console.log(`(This is approximate - actual blocks from cached data: 23040860 to 23047787)\n`);
  
  // Query events in smaller chunks
  const CHUNK_SIZE = 1000;
  let totalDay110Creates = 0;
  
  console.log('Scanning for Created events with 88-day duration...\n');
  
  for (let fromBlock = 23040860; fromBlock <= 23047787; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, 23047787);
    
    try {
      const events = await contract.queryFilter(
        contract.filters.Created(),
        fromBlock,
        toBlock
      );
      
      for (const event of events) {
        const endTime = event.args.endTime.toNumber();
        const startTime = (await provider.getBlock(event.blockNumber)).timestamp;
        const duration = Math.round((endTime - startTime) / 86400); // days
        
        if (duration === 88) {
          totalDay110Creates++;
        }
      }
      
      process.stdout.write(`\rScanned blocks ${fromBlock}-${toBlock}: Found ${totalDay110Creates} creates with 88-day duration`);
      
    } catch (error) {
      console.log(`\n⚠️  Error scanning blocks ${fromBlock}-${toBlock}: ${error.message}`);
    }
  }
  
  console.log(`\n\n✅ Total creates with 88-day duration from Day 22: ${totalDay110Creates}`);
  console.log(`📊 These will all mature on Day 110 (October 27, 2025)`);
}

verifyDay110Creates().catch(console.error);