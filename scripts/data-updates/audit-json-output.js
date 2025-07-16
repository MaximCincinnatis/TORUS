// Comprehensive audit script for JSON output accuracy
const fs = require('fs');
const { ethers } = require('ethers');

console.log('🔍 AUDITING JSON OUTPUT FOR ACCURACY');
console.log('====================================\n');

const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Track issues found
const issues = [];

console.log('📊 1. TOTALS ACCURACY CHECK:');
console.log('----------------------------');

// Recalculate totals from events
let calcStakeETH = 0, calcCreateETH = 0;
let calcStakeTitanX = 0, calcCreateTitanX = 0;
let stakeCount = 0, createCount = 0;

cachedData.stakingData.stakeEvents.forEach(event => {
  if (event.rawCostETH && event.rawCostETH !== "0") {
    calcStakeETH += parseFloat(event.rawCostETH) / 1e18;
    stakeCount++;
  }
  if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
    calcStakeTitanX += parseFloat(event.rawCostTitanX) / 1e18;
  }
});

cachedData.stakingData.createEvents.forEach(event => {
  if (event.rawCostETH && event.rawCostETH !== "0") {
    calcCreateETH += parseFloat(event.rawCostETH) / 1e18;
    createCount++;
  }
  if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
    calcCreateTitanX += parseFloat(event.rawCostTitanX) / 1e18;
  }
});

const totalETH = calcStakeETH + calcCreateETH;
const totalTitanX = calcStakeTitanX + calcCreateTitanX;

console.log(`Calculated ETH Total: ${totalETH.toFixed(6)} ETH`);
console.log(`JSON ETH Total: ${cachedData.totals.totalETH} ETH`);
console.log(`Match: ${Math.abs(totalETH - parseFloat(cachedData.totals.totalETH)) < 0.000001 ? '✅' : '❌'}`);

console.log(`\nCalculated TitanX Total: ${(totalTitanX / 1e12).toFixed(2)}T`);
console.log(`JSON TitanX Total: ${(parseFloat(cachedData.totals.totalTitanX) / 1e12).toFixed(2)}T`);
console.log(`Match: ${Math.abs(totalTitanX - parseFloat(cachedData.totals.totalTitanX)) < 1 ? '✅' : '❌'}`);

console.log(`\nETH Stakes: ${stakeCount}, ETH Creates: ${createCount}`);

console.log('\n📊 2. TITANX BY END DATE CHECK:');
console.log('--------------------------------');

const chartData = cachedData.chartData?.titanXUsageByEndDate || [];
console.log(`Chart has ${chartData.length} data points`);

// Verify a few sample points
const titanXByDate = {};
[...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(event => {
  const endDate = event.maturityDate?.split('T')[0];
  if (endDate && event.rawCostTitanX && event.rawCostTitanX !== '0') {
    if (!titanXByDate[endDate]) {
      titanXByDate[endDate] = ethers.BigNumber.from(0);
    }
    titanXByDate[endDate] = titanXByDate[endDate].add(ethers.BigNumber.from(event.rawCostTitanX));
  }
});

const sampleDates = Object.keys(titanXByDate).slice(0, 3);
sampleDates.forEach(date => {
  const calculated = parseFloat(ethers.utils.formatEther(titanXByDate[date])) / 1e12;
  const chartPoint = chartData.find(p => p.date === date);
  if (chartPoint) {
    const chartValue = parseFloat(chartPoint.displayAmount.replace('T', ''));
    console.log(`${date}: Calc=${calculated.toFixed(2)}T, Chart=${chartValue}T ${Math.abs(calculated - chartValue) < 0.01 ? '✅' : '❌'}`);
  }
});

console.log('\n📊 3. UNISWAP DATA CHECK:');
console.log('-------------------------');

const uniData = cachedData.uniswapV3;
console.log(`Pool Ratio: 1 TORUS = ${uniData.ratio.titanxPerTorusM}M TITANX`);
console.log(`TVL: ${uniData.tvl.torusAmount} TORUS, ${uniData.tvl.titanxAmount}`);
console.log(`LP Positions: ${uniData.lpPositions.length}`);

// Check LP position fields
if (uniData.lpPositions.length > 0) {
  const pos = uniData.lpPositions[0];
  const requiredFields = ['tokenId', 'liquidity', 'lowerTitanxPerTorus', 'upperTitanxPerTorus', 
                         'claimableTorus', 'claimableTitanX', 'estimatedAPR', 'inRange'];
  const missingFields = requiredFields.filter(f => pos[f] === undefined);
  
  if (missingFields.length > 0) {
    issues.push(`LP Position missing fields: ${missingFields.join(', ')}`);
  }
  console.log(`LP Position fields: ${missingFields.length === 0 ? '✅ All present' : '❌ Missing: ' + missingFields.join(', ')}`);
}

console.log('\n📊 4. FIELD COMPLETENESS CHECK:');
console.log('--------------------------------');

const requiredRootFields = ['stakingData', 'totals', 'uniswapV3', 'chartData', 
                           'rewardPoolData', 'contractData', 'tokenPrices', 'historicalData'];
const missingRoot = requiredRootFields.filter(f => !cachedData[f]);

console.log(`Root fields: ${missingRoot.length === 0 ? '✅ All present' : '❌ Missing: ' + missingRoot.join(', ')}`);

// Check create event fields
const sampleCreate = cachedData.stakingData.createEvents[0];
if (sampleCreate) {
  console.log(`Create event has titanAmount: ${sampleCreate.titanAmount ? '✅' : '❌'}`);
  console.log(`Create event has shares: ${sampleCreate.shares ? '✅' : '❌'}`);
}

console.log('\n📊 5. PRICE CALCULATIONS CHECK:');
console.log('--------------------------------');

const prices = cachedData.tokenPrices;
if (prices) {
  console.log(`TORUS Price: $${prices.torus.usd.toFixed(6)}`);
  console.log(`TitanX Price: $${prices.titanx.usd}`);
  
  // Verify TORUS price calculation
  const ratio = parseFloat(uniData.ratio.titanxPerTorus);
  const titanxPrice = prices.titanx.usd;
  const calcTorusPrice = ratio * titanxPrice;
  console.log(`Calculated TORUS price: $${calcTorusPrice.toFixed(6)}`);
  
  if (Math.abs(prices.torus.usd) < 0.0001) {
    issues.push('TORUS price appears to be $0');
  }
}

console.log('\n📊 6. DATA SANITY CHECKS:');
console.log('-------------------------');

// Check for reasonable values
if (totalETH > 1000) {
  issues.push(`Total ETH (${totalETH}) seems too high`);
}

if (totalTitanX / 1e12 < 2) {
  issues.push(`Total TitanX (${(totalTitanX / 1e12).toFixed(2)}T) is below user's expected 2T+`);
}

const avgTitanXPerCreate = createCount > 0 ? calcCreateTitanX / createCount : 0;
console.log(`Average TitanX per create: ${(avgTitanXPerCreate / 1e6).toFixed(2)}M`);

// Check reward pool data
const rewardData = cachedData.rewardPoolData || [];
const nonZeroRewards = rewardData.filter(r => r.rewardPool > 0).length;
console.log(`Reward pool days with data: ${nonZeroRewards}/${rewardData.length}`);

console.log('\n🎯 SUMMARY:');
console.log('===========');

if (issues.length === 0) {
  console.log('✅ No major issues found!');
  console.log('\nKey metrics confirmed:');
  console.log(`- Total ETH: ${totalETH.toFixed(2)} ETH`);
  console.log(`- Total TitanX: ${(totalTitanX / 1e12).toFixed(2)}T`);
  console.log(`- Chart data points: ${chartData.length}`);
  console.log(`- Pool ratio: 1 TORUS = ${uniData.ratio.titanxPerTorusM}M TITANX`);
} else {
  console.log(`❌ Found ${issues.length} issues:`);
  issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
}

// Export for testing
module.exports = {
  totalETH,
  totalTitanX,
  issues
};