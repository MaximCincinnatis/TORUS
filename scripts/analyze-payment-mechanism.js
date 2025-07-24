const { ethers } = require('ethers');
const fs = require('fs');

async function analyzePaymentMechanism() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  console.log('=== ANALYZING PAYMENT MECHANISM ===\n');
  
  // Let's check a known create with TitanX payment from earlier days
  const knownTitanXCreate = data.stakingData.createEvents.find(c => 
    c.titanXAmount && parseFloat(c.titanXAmount) > 0 && c.transactionHash
  );
  
  if (knownTitanXCreate) {
    console.log('KNOWN CREATE WITH TITANX:');
    console.log(`Date: ${new Date(parseInt(knownTitanXCreate.timestamp) * 1000).toISOString()}`);
    console.log(`TitanX Amount: ${(parseFloat(knownTitanXCreate.titanXAmount) / 1e18).toLocaleString()}`);
    console.log(`Tx Hash: ${knownTitanXCreate.transactionHash}`);
    
    if (knownTitanXCreate.transactionHash) {
      const tx = await provider.getTransaction(knownTitanXCreate.transactionHash);
      console.log(`Function selector: ${tx.data.substring(0, 10)}`);
      console.log(`Data length: ${tx.data.length}`);
    }
  }
  
  // Check a Day 12 create that claims to have TitanX
  console.log('\n\nDAY 12 CREATE (from JSON):');
  const day12Create = data.stakingData.createEvents.find(c => {
    const date = new Date(parseInt(c.timestamp) * 1000);
    return date >= new Date('2025-07-21T00:00:00Z') && 
           date < new Date('2025-07-22T00:00:00Z') &&
           c.titanXAmount && parseFloat(c.titanXAmount) > 0;
  });
  
  if (day12Create) {
    console.log(`User: ${day12Create.user}`);
    console.log(`TitanX Amount (JSON): ${(parseFloat(day12Create.titanXAmount) / 1e18).toLocaleString()}`);
    console.log(`Tx Hash: ${day12Create.transactionHash || 'missing'}`);
    
    // The issue might be that the JSON has the data but it wasn't fetched from chain
    // Let's verify by checking TitanX token transfers
    if (day12Create.blockNumber) {
      console.log('\nChecking for TitanX transfers in same block...');
      
      const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
      const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
      const userAddress = ethers.utils.hexZeroPad(day12Create.user.toLowerCase(), 32);
      
      try {
        const logs = await provider.getLogs({
          address: TITANX_CONTRACT,
          topics: [transferTopic, userAddress], // From user
          fromBlock: day12Create.blockNumber,
          toBlock: day12Create.blockNumber
        });
        
        console.log(`Found ${logs.length} TitanX transfers from user in block ${day12Create.blockNumber}`);
        
        logs.forEach(log => {
          const amount = ethers.BigNumber.from(log.data);
          console.log(`  Transfer: ${ethers.utils.formatEther(amount)} TitanX`);
          console.log(`  To: 0x${log.topics[2].substring(26)}`);
        });
      } catch (e) {
        console.log('Error checking transfers:', e.message);
      }
    }
  }
  
  // Summary of findings
  console.log('\n\n=== FINDINGS ===');
  console.log('1. Stake/Create functions only take 2 parameters (amount, days)');
  console.log('2. Payment method is NOT specified in function call');
  console.log('3. Payment happens through separate token transfers or ETH value');
  console.log('4. Our JSON data might have payment info from event parsing, not from contract state');
  console.log('5. Contract state queries fail because creates/stakes may have been claimed');
  
  console.log('\n=== RECOMMENDATION ===');
  console.log('To verify payment data, we need to:');
  console.log('1. Check TitanX Transfer events TO the contract in the same transaction');
  console.log('2. Check if ETH was sent with the transaction (tx.value > 0)');
  console.log('3. Trust the existing JSON data if it was parsed correctly from events initially');
}

analyzePaymentMechanism().catch(console.error);