export const CONTRACTS = {
  TORUS_TOKEN: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
  TORUS_BUY_PROCESS: '0xaa390a37006e22b5775a34f2147f81ebd6a63641',
} as const;

export const CREATE_STAKE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "stakeIndex", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "torusAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256"}
    ],
    "name": "Created",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "stakeIndex", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "principal", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "stakingDays", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256"}
    ],
    "name": "Staked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "id", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "principal", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "reward", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "Claimed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "getCurrentDayIndex",
    "outputs": [{"internalType": "uint24", "name": "", "type": "uint24"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "protocolStart",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint24", "name": "day", "type": "uint24"}],
    "name": "rewardPool",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint24", "name": "day", "type": "uint24"}],
    "name": "totalShares",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint24", "name": "day", "type": "uint24"}],
    "name": "penaltiesInRewardPool",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalTitanXBurnt",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getStakePositions",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "principal", "type": "uint256"},
          {"internalType": "uint256", "name": "power", "type": "uint256"},
          {"internalType": "uint24", "name": "stakingDays", "type": "uint24"},
          {"internalType": "uint256", "name": "startTime", "type": "uint256"},
          {"internalType": "uint24", "name": "startDayIndex", "type": "uint24"},
          {"internalType": "uint256", "name": "endTime", "type": "uint256"},
          {"internalType": "uint256", "name": "shares", "type": "uint256"},
          {"internalType": "bool", "name": "claimedCreate", "type": "bool"},
          {"internalType": "bool", "name": "claimedStake", "type": "bool"},
          {"internalType": "uint256", "name": "costTitanX", "type": "uint256"},
          {"internalType": "uint256", "name": "costETH", "type": "uint256"},
          {"internalType": "uint256", "name": "rewards", "type": "uint256"},
          {"internalType": "uint256", "name": "penalties", "type": "uint256"},
          {"internalType": "uint256", "name": "claimedAt", "type": "uint256"},
          {"internalType": "bool", "name": "isCreate", "type": "bool"}
        ],
        "internalType": "struct StakeTorus[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const TORUS_TOKEN_ABI = [
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  }
];