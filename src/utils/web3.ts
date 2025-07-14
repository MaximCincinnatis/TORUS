import Web3 from 'web3';
import { CONTRACTS, CREATE_STAKE_ABI } from '../constants/contracts';

const RPC_URL = 'https://rpc.ankr.com/eth';

let web3Instance: Web3 | null = null;

export const getWeb3 = () => {
  if (!web3Instance) {
    web3Instance = new Web3(new Web3.providers.HttpProvider(RPC_URL));
  }
  return web3Instance;
};

export const getCreateStakeContract = () => {
  try {
    const web3 = getWeb3();
    return new web3.eth.Contract(CREATE_STAKE_ABI as any, CONTRACTS.TORUS_CREATE_STAKE);
  } catch (error) {
    console.error('Error creating contract instance:', error);
    return null;
  }
};

export interface StakeEvent {
  user: string;
  id: string;
  principal: string;
  shares: string;
  duration: string;
  timestamp: string;
  maturityDate: Date;
}

export interface CreateEvent {
  user: string;
  torusAmount: string;
  titanAmount: string;
  timestamp: string;
}

export const fetchStakeEvents = async (fromBlock: number = 0): Promise<StakeEvent[]> => {
  const contract = getCreateStakeContract();
  
  if (!contract) {
    console.warn('Contract not initialized, returning empty events');
    return [];
  }
  
  try {
    // Get current block number
    const web3 = getWeb3();
    const currentBlock = await web3.eth.getBlockNumber();
    const startBlock = Math.max(Number(currentBlock) - 10000, 0); // Last 10k blocks
    
    const events = await contract.getPastEvents('Staked', {
      fromBlock: startBlock,
      toBlock: 'latest',
    });
    
    return events.map((event: any) => {
      const timestamp = parseInt(event.returnValues.timestamp);
      const duration = parseInt(event.returnValues.duration);
      const maturityDate = new Date((timestamp + duration * 86400) * 1000);
      
      return {
        user: event.returnValues.user,
        id: event.returnValues.id,
        principal: event.returnValues.principal,
        shares: event.returnValues.shares,
        duration: event.returnValues.duration,
        timestamp: event.returnValues.timestamp,
        maturityDate,
      };
    });
  } catch (error) {
    console.error('Error fetching stake events:', error);
    return [];
  }
};

export const fetchCreateEvents = async (fromBlock: number = 0): Promise<CreateEvent[]> => {
  const contract = getCreateStakeContract();
  
  if (!contract) {
    console.warn('Contract not initialized, returning empty events');
    return [];
  }
  
  try {
    // Get current block number
    const web3 = getWeb3();
    const currentBlock = await web3.eth.getBlockNumber();
    const startBlock = Math.max(Number(currentBlock) - 10000, 0); // Last 10k blocks
    
    const events = await contract.getPastEvents('Created', {
      fromBlock: startBlock,
      toBlock: 'latest',
    });
    
    return events.map((event: any) => ({
      user: event.returnValues.user,
      torusAmount: event.returnValues.torusAmount,
      titanAmount: event.returnValues.titanAmount,
      timestamp: event.returnValues.timestamp,
    }));
  } catch (error) {
    console.error('Error fetching create events:', error);
    return [];
  }
};