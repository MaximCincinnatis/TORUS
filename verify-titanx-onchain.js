#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

console.log('🔍 VERIFYING TITANX TRACKING AGAINST BLOCKCHAIN');
console.log('==============================================\n');

async function verifyTitanX() {
  try {
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    
    // Contract addresses
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
    
    // Load current data
    const buyProcessData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
    
    console.log('📊 TRACKED TITANX TOTALS:');
    console.log(`  TitanX Used for Burns: ${buyProcessData.totals.titanXUsedForBurns}`);
    console.log(`  TitanX Used for Builds: ${buyProcessData.totals.titanXUsedForBuilds || 'N/A'}`);
    console.log(`  Total TitanX Burnt: ${buyProcessData.totals.titanXBurnt}`);
    
    // Get contract totals
    console.log('\n🔗 FETCHING CONTRACT TOTALS:');
    const buyProcessABI = [
      'function titanXUsedForBurns() view returns (uint256)',
      'function titanXUsedForBuilds() view returns (uint256)', 
      'function totalTitanXBurnt() view returns (uint256)'
    ];
    
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    
    const [
      contractTitanXForBurns,
      contractTitanXForBuilds,
      contractTotalTitanXBurnt
    ] = await Promise.all([
      buyProcessContract.titanXUsedForBurns(),
      buyProcessContract.titanXUsedForBuilds(),
      buyProcessContract.totalTitanXBurnt()
    ]);
    
    console.log(`  Contract TitanX Used for Burns: ${ethers.utils.formatEther(contractTitanXForBurns)}`);
    console.log(`  Contract TitanX Used for Builds: ${ethers.utils.formatEther(contractTitanXForBuilds)}`);
    console.log(`  Contract Total TitanX Burnt: ${ethers.utils.formatEther(contractTotalTitanXBurnt)}`);
    
    // Check TitanX transfers to Buy & Process contract
    console.log('\n🔍 CHECKING TITANX TRANSFERS TO BUY & PROCESS:');
    
    const titanXABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const titanXContract = new ethers.Contract(TITANX_CONTRACT, titanXABI, provider);
    
    // Get some recent transfers to verify
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 50000; // About 1 week
    
    console.log(`  Checking blocks ${fromBlock} to ${currentBlock}...`);
    
    try {
      // Get transfers TO the Buy & Process contract
      const transfersIn = await titanXContract.queryFilter(
        titanXContract.filters.Transfer(null, BUY_PROCESS_CONTRACT),
        fromBlock,
        currentBlock
      );
      
      console.log(`  Found ${transfersIn.length} TitanX transfers TO Buy & Process`);
      
      if (transfersIn.length > 0) {
        // Show last 5 transfers
        console.log('\n  Recent TitanX transfers IN (last 5):');
        transfersIn.slice(-5).forEach((transfer, i) => {
          const amount = ethers.utils.formatEther(transfer.args.value);
          console.log(`    ${i + 1}. Block ${transfer.blockNumber}: ${amount} TitanX from ${transfer.args.from.slice(0, 10)}...`);
        });
        
        // Calculate total recent transfers
        const recentTotal = transfersIn.reduce((sum, t) => 
          sum.add(t.args.value), ethers.BigNumber.from(0)
        );
        console.log(`\n  Total recent TitanX IN: ${ethers.utils.formatEther(recentTotal)}`);
      }
      
      // Get transfers FROM (burns)
      const transfersOut = await titanXContract.queryFilter(
        titanXContract.filters.Transfer(BUY_PROCESS_CONTRACT, null),
        fromBlock,
        currentBlock
      );
      
      console.log(`\n  Found ${transfersOut.length} TitanX transfers FROM Buy & Process`);
      
      // Check for burns (transfers to 0x0)
      const burns = transfersOut.filter(t => 
        t.args.to === '0x0000000000000000000000000000000000000000'
      );
      
      console.log(`  TitanX burns to 0x0: ${burns.length}`);
      
    } catch (e) {
      console.log('  ⚠️  Could not fetch all transfers (RPC limit)');
    }
    
    // Compare tracked vs contract
    console.log('\n📊 VERIFICATION RESULTS:');
    
    const trackedBurns = parseFloat(buyProcessData.totals.titanXUsedForBurns);
    const contractBurns = parseFloat(ethers.utils.formatEther(contractTitanXForBurns));
    const burnsDiff = Math.abs(trackedBurns - contractBurns);
    
    console.log('\n  TitanX Used for Burns:');
    console.log(`    Tracked:  ${trackedBurns.toFixed(2)}`);
    console.log(`    Contract: ${contractBurns.toFixed(2)}`);
    console.log(`    Match: ${burnsDiff < 0.01 ? '✅ YES' : '❌ NO (diff: ' + burnsDiff.toFixed(2) + ')'}`);
    
    // Calculate tracked builds total from daily data
    const trackedBuilds = buyProcessData.dailyData.reduce((sum, day) => 
      sum + (day.titanXUsedForBuilds || 0), 0
    );
    const contractBuilds = parseFloat(ethers.utils.formatEther(contractTitanXForBuilds));
    const buildsDiff = Math.abs(trackedBuilds - contractBuilds);
    
    console.log('\n  TitanX Used for Builds:');
    console.log(`    Tracked:  ${trackedBuilds.toFixed(2)}`);
    console.log(`    Contract: ${contractBuilds.toFixed(2)}`);
    console.log(`    Match: ${buildsDiff < 0.01 ? '✅ YES' : '❌ NO (diff: ' + buildsDiff.toFixed(2) + ')'}`);
    
    const totalTitanXBurnt = parseFloat(ethers.utils.formatEther(contractTotalTitanXBurnt));
    console.log('\n  Total TitanX Burnt (to 0x0):');
    console.log(`    Contract: ${totalTitanXBurnt.toFixed(2)}`);
    console.log(`    Note: This should be 0 as Buy & Process doesn't burn TitanX directly`);
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    if (burnsDiff < 0.01 && buildsDiff < 0.01) {
      console.log('  ✅ TitanX tracking is ACCURATE and matches on-chain data');
    } else {
      console.log('  ❌ TitanX tracking has discrepancies:');
      if (burnsDiff >= 0.01) console.log(`    - Burns off by ${burnsDiff.toFixed(2)} TitanX`);
      if (buildsDiff >= 0.01) console.log(`    - Builds off by ${buildsDiff.toFixed(2)} TitanX`);
    }
    
    // Check daily data consistency
    console.log('\n📅 DAILY DATA CHECK:');
    const dailyBurnsTotal = buyProcessData.dailyData.reduce((sum, day) => 
      sum + (day.titanXUsedForBurns || 0), 0
    );
    const dailyBuildsTotal = buyProcessData.dailyData.reduce((sum, day) => 
      sum + (day.titanXUsedForBuilds || 0), 0
    );
    
    console.log(`  Daily burns sum: ${dailyBurnsTotal.toFixed(2)}`);
    console.log(`  Daily builds sum: ${dailyBuildsTotal.toFixed(2)}`);
    console.log(`  Total from dailies: ${(dailyBurnsTotal + dailyBuildsTotal).toFixed(2)}`);
    
  } catch (e) {
    console.log(`\n❌ Error: ${e.message}`);
  }
}

verifyTitanX();