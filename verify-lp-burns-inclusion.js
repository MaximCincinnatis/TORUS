const { ethers } = require('ethers');
require('dotenv').config();

async function verifyLPBurnsInclusion() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  
  // LP fee burn transactions from buy-process-burns.json
  const lpFeeBurnTxs = [
    { tx: '0x65f4d4d6450701c3c9c44e4913c7434ad423587366c323654782580e53514669', amount: '161.527971146914771679' },
    { tx: '0x7e22b18f2d79f88f20ec6fbd380b65a69167e3d1e4dbb54350a74ce8be39ca03', amount: '18.49596387540490905' },
    { tx: '0xa7342ca7f20e164e57ce5f4ab3eabdf5b862b3da70867f7ae44e309a143a5753', amount: '38.108102380258301157' }
  ];
  
  console.log('=== VERIFYING LP FEE BURN INCLUSION ===\n');
  
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  for (const lpBurn of lpFeeBurnTxs) {
    console.log(`\nChecking transaction: ${lpBurn.tx}`);
    console.log(`Expected burn amount: ${lpBurn.amount} TORUS`);
    
    try {
      const receipt = await provider.getTransactionReceipt(lpBurn.tx);
      
      // Find TORUS burns (transfers to 0x0) from Buy & Process contract
      const burnLogs = receipt.logs.filter(log => 
        log.address.toLowerCase() === TORUS_TOKEN.toLowerCase() &&
        log.topics[0] === transferEventSig
      );
      
      console.log(`Found ${burnLogs.length} TORUS transfer events`);
      
      let foundBurnFromBuyProcess = false;
      
      for (const log of burnLogs) {
        const from = ethers.utils.getAddress('0x' + log.topics[1].slice(26));
        const to = ethers.utils.getAddress('0x' + log.topics[2].slice(26));
        const amount = ethers.utils.formatEther(log.data);
        
        console.log(`  Transfer: ${from} → ${to}: ${amount} TORUS`);
        
        if (from.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase() && 
            to === '0x0000000000000000000000000000000000000000') {
          foundBurnFromBuyProcess = true;
          console.log(`  ✅ FOUND: Buy & Process burning ${amount} TORUS to 0x0`);
          console.log(`  Matches expected amount: ${Math.abs(parseFloat(amount) - parseFloat(lpBurn.amount)) < 0.0001}`);
        }
      }
      
      if (!foundBurnFromBuyProcess) {
        console.log('  ❌ NO BURN from Buy & Process to 0x0 found in this transaction!');
      }
      
    } catch (error) {
      console.error(`Error checking tx ${lpBurn.tx}:`, error.message);
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('If burns were found from Buy & Process → 0x0, they SHOULD be included in the 3843.58 total');
  console.log('The update-buy-process-data.js script tracks ALL transfers from Buy & Process to 0x0');
}

verifyLPBurnsInclusion().catch(console.error);