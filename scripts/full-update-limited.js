/**
 * Modified version of full update that only processes a specific block range
 * For testing consistency with incremental update
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { 
  CONTRACT_ADDRESSES, 
  EVENT_ABIS, 
  EVENT_TOPICS,
  getProtocolDay 
} = require('./shared/contractConstants');
const { getActualTitanXFromStake } = require('./shared/titanXHelpers');

// Test configuration
const TEST_START_BLOCK = parseInt(process.env.TEST_START_BLOCK || '22890272');
const TEST_END_BLOCK = parseInt(process.env.TEST_END_BLOCK || '22890772');

console.log(`🧪 LIMITED FULL UPDATE - Blocks ${TEST_START_BLOCK} to ${TEST_END_BLOCK}`);
console.log('=' .repeat(60));

const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');

// Contract ABI for getStakePositions
const STAKE_CONTRACT_ABI = [{
  "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
  "name": "getStakePositions",
  "outputs": [{
    "components": [
      {"internalType": "uint256", "name": "principal", "type": "uint256"},
      {"internalType": "uint256", "name": "power", "type": "uint256"},
      {"internalType": "uint24", "name": "stakingDays", "type": "uint24"},
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint24", "name": "startDayIndex", "type": "uint24"},
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
    "internalType": "struct StakeTorus[]",
    "name": "",
    "type": "tuple[]"
  }],
  "stateMutability": "view",
  "type": "function"
}];

async function runLimitedFullUpdate() {
  try {
    const stakeContract = new ethers.Contract(
      CONTRACT_ADDRESSES.CREATE_STAKE, 
      STAKE_CONTRACT_ABI, 
      provider
    );
    
    // Fetch events in our test range
    console.log('📊 Fetching events...');
    const [createLogs, stakeLogs] = await Promise.all([
      provider.getLogs({
        address: CONTRACT_ADDRESSES.CREATE_STAKE,
        topics: [EVENT_TOPICS.CREATED],
        fromBlock: TEST_START_BLOCK,
        toBlock: TEST_END_BLOCK
      }),
      provider.getLogs({
        address: CONTRACT_ADDRESSES.CREATE_STAKE,
        topics: [EVENT_TOPICS.STAKED],
        fromBlock: TEST_START_BLOCK,
        toBlock: TEST_END_BLOCK
      })
    ]);
    
    console.log(`Found ${createLogs.length} creates and ${stakeLogs.length} stakes`);
    
    // Get block timestamps
    const blockNumbers = new Set();
    createLogs.forEach(log => blockNumbers.add(log.blockNumber));
    stakeLogs.forEach(log => blockNumbers.add(log.blockNumber));
    
    const blockTimestamps = new Map();
    for (const blockNum of blockNumbers) {
      const block = await provider.getBlock(blockNum);
      blockTimestamps.set(blockNum, block.timestamp);
    }
    
    // Process events
    const createInterface = new ethers.utils.Interface([EVENT_ABIS.CREATED]);
    const stakeInterface = new ethers.utils.Interface([EVENT_ABIS.STAKED]);
    
    const createEvents = [];
    const stakeEvents = [];
    
    // Process creates
    for (const log of createLogs) {
      const decoded = createInterface.parseLog(log);
      const timestamp = blockTimestamps.get(log.blockNumber);
      
      const createData = {
        user: decoded.args.user.toLowerCase(),
        stakeIndex: decoded.args.stakeIndex.toString(),
        torusAmount: decoded.args.torusAmount.toString(),
        endTime: decoded.args.endTime.toString(),
        maturityDate: new Date(Number(decoded.args.endTime) * 1000).toISOString(),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: timestamp.toString(),
        protocolDay: getProtocolDay(timestamp)
      };
      
      // Get transaction to check ETH/TitanX
      const tx = await provider.getTransaction(log.transactionHash);
      
      if (tx.value && !tx.value.isZero()) {
        createData.costETH = ethers.utils.formatEther(tx.value);
        createData.rawCostETH = tx.value.toString();
        createData.costTitanX = "0.0";
        createData.rawCostTitanX = "0";
        createData.titanAmount = "0";
      } else {
        createData.costETH = "0.0";
        createData.rawCostETH = "0";
        
        // Get TitanX from receipt
        const receipt = await provider.getTransactionReceipt(log.transactionHash);
        const titanXTransfer = receipt.logs.find(l => 
          l.address.toLowerCase() === CONTRACT_ADDRESSES.TITANX.toLowerCase() &&
          l.topics[0] === EVENT_TOPICS.TRANSFER &&
          l.topics.length >= 3
        );
        
        if (titanXTransfer && titanXTransfer.data !== '0x') {
          const titanXAmount = BigInt(titanXTransfer.data).toString();
          createData.rawCostTitanX = titanXAmount;
          createData.costTitanX = ethers.utils.formatEther(titanXTransfer.data);
          createData.titanAmount = titanXAmount;
        } else {
          createData.costTitanX = "0.0";
          createData.rawCostTitanX = "0";
          createData.titanAmount = "0";
        }
      }
      
      createEvents.push(createData);
    }
    
    // Process stakes
    for (const log of stakeLogs) {
      const decoded = stakeInterface.parseLog(log);
      const timestamp = blockTimestamps.get(log.blockNumber);
      
      const stakeData = {
        user: decoded.args.user.toLowerCase(),
        stakeIndex: decoded.args.stakeIndex.toString(),
        principal: decoded.args.principal.toString(),
        stakingDays: decoded.args.stakingDays.toString(),
        shares: decoded.args.shares.toString(),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: timestamp.toString(),
        protocolDay: getProtocolDay(timestamp),
        maturityDate: new Date((timestamp + decoded.args.stakingDays * 24 * 60 * 60) * 1000).toISOString()
      };
      
      // Get transaction to check ETH
      const tx = await provider.getTransaction(log.transactionHash);
      
      if (tx.value && !tx.value.isZero()) {
        stakeData.costETH = ethers.utils.formatEther(tx.value);
        stakeData.rawCostETH = tx.value.toString();
      } else {
        stakeData.costETH = "0.0";
        stakeData.rawCostETH = "0";
      }
      
      // Always get actual TitanX
      const actualTitanX = await getActualTitanXFromStake(log.transactionHash, provider);
      stakeData.rawCostTitanX = actualTitanX;
      stakeData.costTitanX = ethers.utils.formatEther(actualTitanX);
      stakeData.titanAmount = actualTitanX;
      
      stakeEvents.push(stakeData);
    }
    
    // Get shares for creates
    console.log('📊 Getting shares for creates...');
    const userAddresses = new Set(createEvents.map(e => e.user));
    const userPositions = new Map();
    
    for (const user of userAddresses) {
      const positions = await stakeContract.getStakePositions(user);
      userPositions.set(user, positions);
    }
    
    // Match creates with positions
    let createsWithShares = 0;
    createEvents.forEach(event => {
      const userPos = userPositions.get(event.user);
      if (userPos) {
        const eventTime = parseInt(event.timestamp);
        const matchingPosition = userPos.find(pos => 
          Math.abs(Number(pos.startTime) - eventTime) < 300 && pos.isCreate
        );
        
        if (matchingPosition) {
          event.shares = matchingPosition.shares.toString();
          createsWithShares++;
          
          if (!event.maturityDate) {
            event.maturityDate = new Date(Number(matchingPosition.endTime) * 1000).toISOString();
          }
          if (!event.endTime) {
            event.endTime = matchingPosition.endTime.toString();
          }
        }
      }
    });
    
    console.log(`✅ Matched ${createsWithShares}/${createEvents.length} creates with shares`);
    
    // Save results
    const results = {
      stakingData: {
        createEvents,
        stakeEvents
      },
      lastUpdated: new Date().toISOString(),
      lastProcessedBlock: TEST_END_BLOCK,
      currentProtocolDay: 1
    };
    
    const outputPath = path.join(__dirname, 'test-comparison-output/full-update-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log('\n✅ Limited full update complete!');
    console.log(`Results saved to: ${outputPath}`);
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`- Creates: ${createEvents.length}`);
    console.log(`- Creates with shares: ${createsWithShares}`);
    console.log(`- Stakes: ${stakeEvents.length}`);
    
    const stakesWithTitanX = stakeEvents.filter(s => s.titanAmount && s.titanAmount !== '0').length;
    console.log(`- Stakes with TitanX: ${stakesWithTitanX}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runLimitedFullUpdate();