import { getWeb3 } from './web3';
import { CONTRACTS } from '../constants/contracts';

// Alternative approach: Read contract state directly
export const fetchContractData = async () => {
  try {
    const web3 = getWeb3();
    
    // Get current block
    const currentBlock = await web3.eth.getBlockNumber();
    
    // Try to get some basic blockchain data
    const balance = await web3.eth.getBalance(CONTRACTS.TORUS_CREATE_STAKE);
    
    // Get contract code to verify it exists
    const code = await web3.eth.getCode(CONTRACTS.TORUS_CREATE_STAKE);
    
    return {
      currentBlock: Number(currentBlock),
      contractBalance: web3.utils.fromWei(balance, 'ether'),
      contractExists: code !== '0x'
    };
  } catch (error) {
    return null;
  }
};