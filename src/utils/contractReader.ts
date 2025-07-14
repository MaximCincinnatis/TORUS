import { getWeb3 } from './web3';
import { CONTRACTS } from '../constants/contracts';

// Alternative approach: Read contract state directly
export const fetchContractData = async () => {
  try {
    const web3 = getWeb3();
    
    // Get current block
    const currentBlock = await web3.eth.getBlockNumber();
    console.log('Current block:', currentBlock);
    
    // Try to get some basic blockchain data
    const balance = await web3.eth.getBalance(CONTRACTS.TORUS_CREATE_STAKE);
    console.log('Contract balance:', web3.utils.fromWei(balance, 'ether'), 'ETH');
    
    // Get contract code to verify it exists
    const code = await web3.eth.getCode(CONTRACTS.TORUS_CREATE_STAKE);
    console.log('Contract exists:', code !== '0x');
    
    return {
      currentBlock: Number(currentBlock),
      contractBalance: web3.utils.fromWei(balance, 'ether'),
      contractExists: code !== '0x'
    };
  } catch (error) {
    console.error('Error fetching contract data:', error);
    return null;
  }
};