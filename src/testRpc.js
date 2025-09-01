const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
];

async function testRpc(url) {
  try {
    const provider = new ethers.JsonRpcProvider(url);
    const blockNumber = await provider.getBlockNumber();
    return true;
  } catch (error) {
    return false;
  }
}

async function testAll() {
  for (const url of RPC_ENDPOINTS) {
    await testRpc(url);
  }
}

testAll();