#!/usr/bin/env node

/**
 * Analyze how ETH flows into the Buy & Process contract
 */

const { ethers } = require('ethers');
const axios = require('axios');

async function analyzeETHInflows() {
  console.log('🔍 Analyzing ETH inflows to Buy & Process contract...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Get contract deployment info
  const deployBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  
  // Check if we have Etherscan API key
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.log('⚠️  No ETHERSCAN_API_KEY found. Please set it to analyze ETH transfers.');
    console.log('Without API key, we can only see contract balance, not individual transfers.\n');
  }
  
  try {
    // Get current balance
    const currentBalance = await provider.getBalance(BUY_PROCESS_CONTRACT);
    console.log(`Current contract balance: ${ethers.utils.formatEther(currentBalance)} ETH\n`);
    
    // Contract ABI for reading state
    const contractABI = [
      'function ethUsedForBurns() view returns (uint256)',
      'function ethUsedForBuilds() view returns (uint256)',
      'function totalETHBurn() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Get ETH usage states
    const [ethUsedForBurns, ethUsedForBuilds, totalETHBurn] = await Promise.all([
      contract.ethUsedForBurns(),
      contract.ethUsedForBuilds(),
      contract.totalETHBurn()
    ]);
    
    console.log('📊 Contract ETH Usage States:');
    console.log('=============================');
    console.log(`ethUsedForBurns: ${ethers.utils.formatEther(ethUsedForBurns)} ETH`);
    console.log(`ethUsedForBuilds: ${ethers.utils.formatEther(ethUsedForBuilds)} ETH`);
    console.log(`totalETHBurn: ${ethers.utils.formatEther(totalETHBurn)} ETH`);
    console.log(`Total used: ${ethers.utils.formatEther(ethUsedForBurns.add(ethUsedForBuilds))} ETH\n`);
    
    if (apiKey) {
      console.log('📈 Fetching ETH transfers from Etherscan...\n');
      
      // Fetch all transactions to the contract
      const url = 'https://api.etherscan.io/api';
      const txResponse = await axios.get(url, {
        params: {
          module: 'account',
          action: 'txlist',
          address: BUY_PROCESS_CONTRACT,
          startblock: deployBlock,
          endblock: currentBlock,
          sort: 'asc',
          apikey: apiKey
        }
      });
      
      if (txResponse.data.status === '1') {
        const transactions = txResponse.data.result || [];
        
        // Filter transactions that sent ETH
        const ethTransfers = transactions.filter(tx => 
          tx.to.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase() && 
          tx.value !== '0'
        );
        
        console.log(`Found ${ethTransfers.length} ETH transfers to the contract\n`);
        
        // Analyze by function signature
        const functionCounts = {};
        let totalETHReceived = ethers.BigNumber.from(0);
        
        // Known function signatures
        const knownFunctions = {
          '0x6ba275bc': 'distributeETHForBurning()',
          '0xd5a47864': 'distributeETHForBuilding()',
          '0x': 'Direct ETH transfer (no data)',
          '0xd0e30db0': 'deposit()',
          '0x1e7d0fb0': 'swapETHForTorusAndBurn()',
          '0x53ad9b96': 'swapETHForTorusAndBuild()'
        };
        
        // Group transfers by sender
        const transfersBySender = {};
        
        ethTransfers.forEach(tx => {
          const methodId = tx.input.slice(0, 10);
          const functionName = knownFunctions[methodId] || `Unknown (${methodId})`;
          
          functionCounts[functionName] = (functionCounts[functionName] || 0) + 1;
          totalETHReceived = totalETHReceived.add(ethers.BigNumber.from(tx.value));
          
          // Track by sender
          if (!transfersBySender[tx.from]) {
            transfersBySender[tx.from] = {
              count: 0,
              totalETH: ethers.BigNumber.from(0),
              functions: {}
            };
          }
          
          transfersBySender[tx.from].count++;
          transfersBySender[tx.from].totalETH = transfersBySender[tx.from].totalETH.add(ethers.BigNumber.from(tx.value));
          transfersBySender[tx.from].functions[functionName] = (transfersBySender[tx.from].functions[functionName] || 0) + 1;
        });
        
        console.log('📊 ETH Transfers by Function:');
        console.log('=============================');
        Object.entries(functionCounts).forEach(([func, count]) => {
          console.log(`${func}: ${count} transfers`);
        });
        
        console.log(`\nTotal ETH received: ${ethers.utils.formatEther(totalETHReceived)} ETH`);
        
        // Show top senders
        console.log('\n📊 Top ETH Senders:');
        console.log('==================');
        const topSenders = Object.entries(transfersBySender)
          .sort((a, b) => b[1].totalETH.gt(a[1].totalETH) ? 1 : -1)
          .slice(0, 10);
        
        topSenders.forEach(([address, data]) => {
          console.log(`\n${address}:`);
          console.log(`  Total sent: ${ethers.utils.formatEther(data.totalETH)} ETH`);
          console.log(`  Transactions: ${data.count}`);
          console.log(`  Functions used:`);
          Object.entries(data.functions).forEach(([func, count]) => {
            console.log(`    - ${func}: ${count}`);
          });
        });
        
        // Check for distributeETH calls specifically
        const distributeForBurning = ethTransfers.filter(tx => tx.input.startsWith('0x6ba275bc'));
        const distributeForBuilding = ethTransfers.filter(tx => tx.input.startsWith('0xd5a47864'));
        
        console.log('\n📊 Distribution Function Analysis:');
        console.log('=================================');
        console.log(`distributeETHForBurning() calls: ${distributeForBurning.length}`);
        console.log(`distributeETHForBuilding() calls: ${distributeForBuilding.length}`);
        
        if (distributeForBurning.length > 0 || distributeForBuilding.length > 0) {
          console.log('\n⚠️  IMPORTANT FINDING:');
          console.log('The contract receives ETH through distributeETHForBurning/Building functions!');
          console.log('This means ETH is sent FROM another contract that distributes it.');
          console.log('Individual burn transactions show 0 ETH because the ETH was already in the contract.');
        }
      }
    }
    
    console.log('\n📋 Summary:');
    console.log('===========');
    console.log('The Buy & Process contract operates in two phases:');
    console.log('1. RECEIVING PHASE: ETH is sent to the contract via distributeETHForBurning()');
    console.log('2. BURNING PHASE: The contract uses its ETH balance to buy and burn TORUS');
    console.log('\nThis is why individual burn transactions show 0 ETH - they are using');
    console.log('ETH that was previously distributed to the contract.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeETHInflows().catch(console.error);