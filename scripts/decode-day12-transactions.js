const { ethers } = require('ethers');

async function decodeDay12Transactions() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Sample transactions from Day 12
  const createTxHash = '0x783fa027d965d7c18bdeb15dcad8f39984a7eb3422dfee914b6a2523bad10f49';
  const stakeTxHash = '0x225f6943f53d845a23a3c92600957cd3e482da6d12ab1f4da1d543d062ab6d33';
  
  console.log('=== DECODING DAY 12 TRANSACTIONS ===\n');
  
  // Fetch create transaction
  console.log('CREATE TRANSACTION:');
  const createTx = await provider.getTransaction(createTxHash);
  console.log(`To: ${createTx.to}`);
  console.log(`Value: ${ethers.utils.formatEther(createTx.value)} ETH`);
  console.log(`Input data (first 10 bytes): ${createTx.data.substring(0, 10)}`);
  console.log(`Full input: ${createTx.data.substring(0, 200)}...`);
  
  // Try to decode with different signatures
  const possibleCreateABIs = [
    'function create(uint256 torusAmount, uint256 numDays, uint256 titanAmount, uint256 ethAmount)',
    'function create(uint256 torusAmount, uint256 numDays)',
    'function createFor(address user, uint256 torusAmount, uint256 numDays, uint256 titanAmount, uint256 ethAmount)',
    'function userCreate(uint256 torusAmount, uint256 numDays, uint256 paymentChoice)'
  ];
  
  console.log('\nTrying to decode create function...');
  for (const abi of possibleCreateABIs) {
    try {
      const iface = new ethers.utils.Interface([abi]);
      const decoded = iface.parseTransaction({ data: createTx.data });
      console.log(`✓ Decoded with: ${abi}`);
      console.log('  Args:', decoded.args);
      break;
    } catch (e) {
      // Continue trying
    }
  }
  
  // Fetch stake transaction
  console.log('\n\nSTAKE TRANSACTION:');
  const stakeTx = await provider.getTransaction(stakeTxHash);
  console.log(`To: ${stakeTx.to}`);
  console.log(`Value: ${ethers.utils.formatEther(stakeTx.value)} ETH`);
  console.log(`Input data (first 10 bytes): ${stakeTx.data.substring(0, 10)}`);
  console.log(`Function selector: ${stakeTx.data.substring(0, 10)}`);
  
  // The stake function selector is 0xac5b271c
  // Try to find the matching function
  const possibleStakeABIs = [
    'function stake(uint256 amount, uint256 numDays, uint256 titanAmount, uint256 ethAmount)',
    'function stake(uint256 amount, uint256 numDays)',
    'function stakeFor(address user, uint256 amount, uint256 numDays)',
    'function userStake(uint256 amount, uint256 numDays, uint256 paymentChoice)',
    'function stakeTorus(uint256 amount, uint256 numDays)'
  ];
  
  console.log('\nTrying to decode stake function...');
  for (const abi of possibleStakeABIs) {
    try {
      const iface = new ethers.utils.Interface([abi]);
      const decoded = iface.parseTransaction({ data: stakeTx.data });
      console.log(`✓ Decoded with: ${abi}`);
      console.log('  Args:', decoded.args);
      break;
    } catch (e) {
      // Try manual decode
      if (e.message.includes('no matching function')) {
        const selector = ethers.utils.id(abi.match(/function (\w+)/)[1] + abi.match(/\(.*\)/)[0]).substring(0, 10);
        if (selector === stakeTx.data.substring(0, 10)) {
          console.log(`Selector matches for ${abi}, but decode failed`);
        }
      }
    }
  }
  
  // Let's decode the data manually
  console.log('\n\nMANUAL DECODE OF STAKE DATA:');
  const stakeData = stakeTx.data;
  console.log('Selector:', stakeData.substring(0, 10));
  console.log('Param 1:', '0x' + stakeData.substring(10, 74)); // First 32 bytes
  console.log('Param 2:', '0x' + stakeData.substring(74, 138)); // Second 32 bytes
  console.log('Param 3:', '0x' + stakeData.substring(138, 202)); // Third 32 bytes if exists
  
  // Convert to numbers
  if (stakeData.length >= 74) {
    const param1 = ethers.BigNumber.from('0x' + stakeData.substring(10, 74));
    console.log('Param 1 as number:', param1.toString());
    console.log('Param 1 as TORUS:', ethers.utils.formatEther(param1));
  }
  if (stakeData.length >= 138) {
    const param2 = ethers.BigNumber.from('0x' + stakeData.substring(74, 138));
    console.log('Param 2 as number:', param2.toString());
  }
}

decodeDay12Transactions().catch(console.error);