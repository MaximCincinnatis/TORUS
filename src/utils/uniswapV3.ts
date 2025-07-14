import { UniswapV3Position, PoolData } from '../types/uniswapV3';

const UNISWAP_V3_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
const POOL_ADDRESS = '0x7ff1f30f6e7eec2ff3f0d1b60739115bdf88190f';

export async function fetchPoolData(): Promise<PoolData | null> {
  const query = `
    query GetPool($poolAddress: String!) {
      pool(id: $poolAddress) {
        id
        sqrtPrice
        tick
        liquidity
        token0Price
        token1Price
        totalValueLockedUSD
        volumeUSD
        feesUSD
        token0 {
          id
          symbol
          decimals
        }
        token1 {
          id
          symbol
          decimals
        }
      }
    }
  `;

  try {
    const response = await fetch(UNISWAP_V3_SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          poolAddress: POOL_ADDRESS.toLowerCase(),
        },
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }

    return data.data?.pool || null;
  } catch (error) {
    console.error('Error fetching pool data:', error);
    return null;
  }
}

export async function fetchLPPositions(first: number = 100, skip: number = 0): Promise<UniswapV3Position[]> {
  const query = `
    query GetPositions($poolAddress: String!, $first: Int!, $skip: Int!) {
      positions(
        first: $first
        skip: $skip
        where: {
          pool: $poolAddress
          liquidity_gt: "0"
        }
        orderBy: liquidity
        orderDirection: desc
      ) {
        id
        owner
        liquidity
        tickLower {
          tickIdx
        }
        tickUpper {
          tickIdx
        }
        depositedToken0
        depositedToken1
        withdrawnToken0
        withdrawnToken1
        collectedFeesToken0
        collectedFeesToken1
        pool {
          sqrtPrice
          tick
          token0Price
          token1Price
          token0 {
            id
            symbol
            decimals
          }
          token1 {
            id
            symbol
            decimals
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(UNISWAP_V3_SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          poolAddress: POOL_ADDRESS.toLowerCase(),
          first,
          skip,
        },
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return [];
    }

    const positions = data.data?.positions || [];
    
    // Transform the data to match our interface
    return positions.map((pos: any) => ({
      id: pos.id,
      owner: pos.owner,
      liquidity: pos.liquidity,
      tickLower: pos.tickLower.tickIdx,
      tickUpper: pos.tickUpper.tickIdx,
      token0: pos.pool.token0,
      token1: pos.pool.token1,
      depositedToken0: pos.depositedToken0,
      depositedToken1: pos.depositedToken1,
      withdrawnToken0: pos.withdrawnToken0,
      withdrawnToken1: pos.withdrawnToken1,
      collectedFeesToken0: pos.collectedFeesToken0,
      collectedFeesToken1: pos.collectedFeesToken1,
      pool: {
        sqrtPrice: pos.pool.sqrtPrice,
        tick: pos.pool.tick,
        token0Price: pos.pool.token0Price,
        token1Price: pos.pool.token1Price,
      },
    }));
  } catch (error) {
    console.error('Error fetching LP positions:', error);
    return [];
  }
}

export async function fetchAllLPPositions(): Promise<UniswapV3Position[]> {
  let allPositions: UniswapV3Position[] = [];
  let skip = 0;
  const batchSize = 1000;
  
  while (true) {
    const positions = await fetchLPPositions(batchSize, skip);
    
    if (positions.length === 0) {
      break;
    }
    
    allPositions = allPositions.concat(positions);
    skip += batchSize;
    
    // Prevent infinite loops
    if (skip > 10000) {
      console.warn('Reached maximum position fetch limit');
      break;
    }
  }
  
  console.log(`Fetched ${allPositions.length} total LP positions`);
  return allPositions;
}