#!/usr/bin/env node

/**
 * Quick fix for Day 21 creates/stakes TitanX amounts
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function fixDay21TitanX() {
  console.log('🔧 Fixing Day 21 TitanX amounts...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    
    // Contract setup
    const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
    
    const createStakeAbi = [
      'event Create(address indexed user, uint256 indexed eventId, uint256 reward, uint256 protocolFee, uint256 stakerFee, uint256 lpFee, address referrer)',
      'event Stake(address indexed user, uint256 indexed eventId, uint256 indexed stakeEventId, uint256 titanAmount)'
    ];
    
    const titanxAbi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
    
    const createStakeContract = new ethers.Contract(CREATE_STAKE_CONTRACT, createStakeAbi, provider);
    const titanxContract = new ethers.Contract(TITANX_ADDRESS, titanxAbi, provider);
    
    // Day 21 starts at July 30 18:00 UTC
    const DAY_21_START = new Date('2025-07-30T18:00:00Z').getTime() / 1000;
    const DAY_21_END = DAY_21_START + (24 * 60 * 60);
    
    // Find blocks for Day 21
    const currentBlock = await provider.getBlockNumber();
    let startBlock = 23032000; // Approximate
    let endBlock = currentBlock;
    
    // Binary search for start block
    let low = startBlock;
    let high = endBlock;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const block = await provider.getBlock(mid);
      if (block.timestamp < DAY_21_START) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    startBlock = low;
    
    // Find end block
    const latestBlock = await provider.getBlock('latest');
    if (latestBlock.timestamp < DAY_21_END) {
      endBlock = latestBlock.number;
    } else {
      // Binary search for end block
      low = startBlock;
      high = endBlock;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const block = await provider.getBlock(mid);
        if (block.timestamp < DAY_21_END) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      endBlock = low - 1;
    }
    
    console.log(`Day 21 blocks: ${startBlock} to ${endBlock}`);
    
    // Fetch events
    const [creates, stakes] = await Promise.all([
      createStakeContract.queryFilter(createStakeContract.filters.Create(), startBlock, endBlock),
      createStakeContract.queryFilter(createStakeContract.filters.Stake(), startBlock, endBlock)
    ]);
    
    console.log(`Found ${creates.length} creates and ${stakes.length} stakes for Day 21\n`);
    
    // Process creates
    let totalTitanXCreates = ethers.BigNumber.from(0);
    let totalETHCreates = ethers.BigNumber.from(0);
    
    for (const event of creates) {
      const tx = await provider.getTransaction(event.transactionHash);
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      
      if (tx.value && !tx.value.isZero()) {
        totalETHCreates = totalETHCreates.add(tx.value);
        console.log(`Create ${event.args.eventId}: ${ethers.utils.formatEther(tx.value)} ETH`);
      } else {
        // Look for TitanX transfer
        const transfers = await titanxContract.queryFilter(
          titanxContract.filters.Transfer(null, CREATE_STAKE_CONTRACT),
          receipt.blockNumber,
          receipt.blockNumber
        );
        
        const titanTransfer = transfers.find(t => t.transactionHash === event.transactionHash);
        if (titanTransfer) {
          totalTitanXCreates = totalTitanXCreates.add(titanTransfer.args.value);
          console.log(`Create ${event.args.eventId}: ${ethers.utils.formatUnits(titanTransfer.args.value, 9)} TitanX`);
        }
      }
    }
    
    // Process stakes
    let totalTitanXStakes = ethers.BigNumber.from(0);
    for (const event of stakes) {
      totalTitanXStakes = totalTitanXStakes.add(event.args.titanAmount);
      console.log(`Stake ${event.args.stakeEventId}: ${ethers.utils.formatUnits(event.args.titanAmount, 9)} TitanX`);
    }
    
    console.log('\n📊 Day 21 Summary:');
    console.log(`Creates: ${creates.length} total`);
    console.log(`  - ETH used: ${ethers.utils.formatEther(totalETHCreates)} ETH`);
    console.log(`  - TitanX used: ${ethers.utils.formatUnits(totalTitanXCreates, 9)} TitanX`);
    console.log(`Stakes: ${stakes.length} total`);
    console.log(`  - TitanX used: ${ethers.utils.formatUnits(totalTitanXStakes, 9)} TitanX`);
    
    // Update incremental script to capture from the right block
    const incrementalScript = fs.readFileSync('./scripts/update-creates-stakes-incremental.js', 'utf8');
    const updatedScript = incrementalScript.replace(
      /const lastBlock = cachedData\.metadata\?\.lastBlockCreatesStakes \|\| \d+;/,
      `const lastBlock = cachedData.metadata?.lastBlockCreatesStakes || ${startBlock - 1};`
    );
    fs.writeFileSync('./scripts/update-creates-stakes-incremental.js', updatedScript);
    
    console.log(`\n✅ Updated incremental script to start from block ${startBlock - 1}`);
    console.log('Run the incremental update to capture Day 21 data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixDay21TitanX();