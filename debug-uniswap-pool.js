const { ethers } = require('ethers');

async function debugUniswapPool() {
  console.log('🔍 DEBUGGING UNISWAP POOL CONFIGURATION');
  console.log('========================================');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Pool address from frontend
  const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
  
  const POOL_ABI = [
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function fee() view returns (uint24)'
  ];
  
  const ERC20_ABI = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)'
  ];
  
  try {
    const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
    
    // Get pool configuration
    const [token0, token1, slot0, fee] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.slot0(),
      poolContract.fee()
    ]);
    
    console.log('\n📊 POOL CONFIGURATION:');
    console.log(`Pool Address: ${POOL_ADDRESS}`);
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    console.log(`Fee Tier: ${fee / 10000}%`);
    
    // Get token details
    const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
    
    const [symbol0, symbol1, decimals0, decimals1, balance0, balance1] = await Promise.all([
      token0Contract.symbol(),
      token1Contract.symbol(),
      token0Contract.decimals(),
      token1Contract.decimals(),
      token0Contract.balanceOf(POOL_ADDRESS),
      token1Contract.balanceOf(POOL_ADDRESS)
    ]);
    
    console.log(`\nToken0 (${symbol0}): ${ethers.utils.formatUnits(balance0, decimals0)}`);
    console.log(`Token1 (${symbol1}): ${ethers.utils.formatUnits(balance1, decimals1)}`);
    
    // Check token addresses
    const TORUS_ADDRESS = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    const TITANX_ADDRESS = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1';
    const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    
    console.log('\n🔍 TOKEN IDENTIFICATION:');
    console.log(`Is TORUS/WETH pool: ${
      (token0.toLowerCase() === TORUS_ADDRESS.toLowerCase() || token1.toLowerCase() === TORUS_ADDRESS.toLowerCase()) &&
      (token0.toLowerCase() === WETH_ADDRESS.toLowerCase() || token1.toLowerCase() === WETH_ADDRESS.toLowerCase())
    }`);
    console.log(`Is TORUS/TITANX pool: ${
      (token0.toLowerCase() === TORUS_ADDRESS.toLowerCase() || token1.toLowerCase() === TORUS_ADDRESS.toLowerCase()) &&
      (token0.toLowerCase() === TITANX_ADDRESS.toLowerCase() || token1.toLowerCase() === TITANX_ADDRESS.toLowerCase())
    }`);
    
    // Calculate price correctly
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPriceX96 = ethers.BigNumber.from(slot0.sqrtPriceX96);
    
    // For TORUS/TITANX pool with 18 decimals each
    if (token0.toLowerCase() === TORUS_ADDRESS.toLowerCase()) {
      // price = (sqrtPrice/2^96)^2 = TITANX per TORUS
      const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(Q96);
      const price = parseFloat(ethers.utils.formatUnits(priceX96, 96));
      console.log(`\n💰 PRICE: 1 TORUS = ${price.toFixed(6)} ${symbol1}`);
    } else {
      // price = 1 / ((sqrtPrice/2^96)^2) = TORUS per TITANX
      const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(Q96);
      const price = 1 / parseFloat(ethers.utils.formatUnits(priceX96, 96));
      console.log(`\n💰 PRICE: 1 TORUS = ${price.toFixed(6)} ${symbol0}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugUniswapPool();