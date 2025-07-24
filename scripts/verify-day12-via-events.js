const { ethers } = require('ethers');
const fs = require('fs');

async function verifyDay12ViaEvents() {
  console.log('🔍 VERIFYING DAY 12 VIA BLOCKCHAIN EVENTS...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Get event signatures
  const createEventABI = [
    'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)'
  ];
  const stakeEventABI = [
    'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)'
  ];
  
  const iface = new ethers.utils.Interface(createEventABI.concat(stakeEventABI));
  
  // Day 12 blocks (approximate)
  const DAY_12_START_BLOCK = 22964000; // July 21 start
  const DAY_12_END_BLOCK = 22971000;   // July 21 end
  
  console.log(`Fetching events from blocks ${DAY_12_START_BLOCK} to ${DAY_12_END_BLOCK}...`);
  
  // Fetch Create events
  const createFilter = {
    address: CREATE_STAKE_CONTRACT,
    topics: [ethers.utils.id('Created(address,uint256,uint256,uint256)')],
    fromBlock: DAY_12_START_BLOCK,
    toBlock: DAY_12_END_BLOCK
  };
  
  const createLogs = await provider.getLogs(createFilter);
  console.log(`\nFound ${createLogs.length} Create events on Day 12`);
  
  // For each create event, fetch the transaction to see payment method
  console.log('\n=== CHECKING CREATE TRANSACTIONS ===');
  let createsWithTitanX = 0;
  let createsWithETH = 0;
  
  for (let i = 0; i < Math.min(10, createLogs.length); i++) {
    const log = createLogs[i];
    const parsedLog = iface.parseLog(log);
    
    console.log(`\nCreate ${i + 1}:`);
    console.log(`  User: ${parsedLog.args.user}`);
    console.log(`  Index: ${parsedLog.args.stakeIndex.toString()}`);
    console.log(`  TORUS Amount: ${(parseFloat(parsedLog.args.torusAmount) / 1e18).toFixed(3)}`);
    console.log(`  Tx Hash: ${log.transactionHash}`);
    
    // Fetch the actual transaction
    try {
      const tx = await provider.getTransaction(log.transactionHash);
      const receipt = await provider.getTransactionReceipt(log.transactionHash);
      
      // Decode the transaction input
      const createFunctionABI = [
        'function create(uint256 torusAmount, uint256 numDays, uint256 titanAmount, uint256 ethAmount)'
      ];
      const createIface = new ethers.utils.Interface(createFunctionABI);
      
      try {
        const decoded = createIface.parseTransaction({ data: tx.data });
        const titanAmount = decoded.args.titanAmount;
        const ethAmount = decoded.args.ethAmount;
        
        console.log(`  Payment Method:`);
        console.log(`    TitanX: ${titanAmount.toString()} (${(parseFloat(titanAmount) / 1e18).toLocaleString()})`);
        console.log(`    ETH: ${ethAmount.toString()} (${(parseFloat(ethAmount) / 1e18).toFixed(4)})`);
        
        if (titanAmount.gt(0)) createsWithTitanX++;
        if (ethAmount.gt(0)) createsWithETH++;
        
        // Check if transaction sent ETH
        if (tx.value && tx.value.gt(0)) {
          console.log(`    ETH sent with tx: ${ethers.utils.formatEther(tx.value)}`);
        }
      } catch (e) {
        console.log(`  Could not decode function data`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.log(`  Error fetching transaction: ${e.message}`);
    }
  }
  
  console.log(`\n=== CREATE SUMMARY ===`);
  console.log(`Total checked: ${Math.min(10, createLogs.length)}`);
  console.log(`With TitanX: ${createsWithTitanX}`);
  console.log(`With ETH: ${createsWithETH}`);
  
  // Fetch Stake events
  const stakeFilter = {
    address: CREATE_STAKE_CONTRACT,
    topics: [ethers.utils.id('Staked(address,uint256,uint256,uint256,uint256)')],
    fromBlock: DAY_12_START_BLOCK,
    toBlock: DAY_12_END_BLOCK
  };
  
  const stakeLogs = await provider.getLogs(stakeFilter);
  console.log(`\n\nFound ${stakeLogs.length} Stake events on Day 12`);
  
  console.log('\n=== CHECKING STAKE TRANSACTIONS ===');
  let stakesWithTitanX = 0;
  let stakesWithETH = 0;
  
  for (let i = 0; i < Math.min(5, stakeLogs.length); i++) {
    const log = stakeLogs[i];
    const parsedLog = iface.parseLog(log);
    
    console.log(`\nStake ${i + 1}:`);
    console.log(`  User: ${parsedLog.args.user}`);
    console.log(`  Index: ${parsedLog.args.stakeIndex.toString()}`);
    console.log(`  Principal: ${(parseFloat(parsedLog.args.principal) / 1e18).toFixed(3)} TORUS`);
    console.log(`  Tx Hash: ${log.transactionHash}`);
    
    // Fetch the actual transaction
    try {
      const tx = await provider.getTransaction(log.transactionHash);
      
      // Decode the transaction input
      const stakeFunctionABI = [
        'function stake(uint256 amount, uint256 numDays, uint256 titanAmount, uint256 ethAmount)'
      ];
      const stakeIface = new ethers.utils.Interface(stakeFunctionABI);
      
      try {
        const decoded = stakeIface.parseTransaction({ data: tx.data });
        const titanAmount = decoded.args.titanAmount;
        const ethAmount = decoded.args.ethAmount;
        
        console.log(`  Payment Method:`);
        console.log(`    TitanX: ${titanAmount.toString()} (${(parseFloat(titanAmount) / 1e18).toLocaleString()})`);
        console.log(`    ETH: ${ethAmount.toString()} (${(parseFloat(ethAmount) / 1e18).toFixed(4)})`);
        
        if (titanAmount.gt(0)) stakesWithTitanX++;
        if (ethAmount.gt(0)) stakesWithETH++;
        
        // Check if transaction sent ETH
        if (tx.value && tx.value.gt(0)) {
          console.log(`    ETH sent with tx: ${ethers.utils.formatEther(tx.value)}`);
        }
      } catch (e) {
        console.log(`  Could not decode function data: ${e.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.log(`  Error fetching transaction: ${e.message}`);
    }
  }
  
  console.log(`\n=== STAKE SUMMARY ===`);
  console.log(`Total checked: ${Math.min(5, stakeLogs.length)}`);
  console.log(`With TitanX: ${stakesWithTitanX}`);
  console.log(`With ETH: ${stakesWithETH}`);
}

verifyDay12ViaEvents().catch(console.error);