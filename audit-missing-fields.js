// Audit what fields our update script might be missing
const fs = require('fs');

console.log('🔍 AUDITING FOR MISSING FRONTEND FIELDS');
console.log('=======================================');

const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Check for fields the frontend expects
const missingFields = [];

console.log('\n📊 1. HISTORICAL DATA CHECK:');
if (!cachedData.historicalData) {
  console.log('❌ Missing historicalData object');
  missingFields.push('historicalData (7day/30day volume, fees, TVL)');
} else {
  console.log('✅ Has historicalData');
}

console.log('\n📊 2. CONTRACT DATA CHECK:');
if (!cachedData.contractData) {
  console.log('❌ Missing contractData object');
  missingFields.push('contractData (token addresses, decimals, pool info)');
} else {
  console.log('✅ Has contractData');
}

console.log('\n📊 3. TOKEN PRICES CHECK:');
if (!cachedData.tokenPrices) {
  console.log('❌ Missing tokenPrices object');
  missingFields.push('tokenPrices (TORUS/TitanX USD prices)');
} else {
  console.log('✅ Has tokenPrices');
}

console.log('\n📊 4. CURRENT PROTOCOL DAY CHECK:');
if (cachedData.currentProtocolDay === undefined) {
  console.log('❌ Missing currentProtocolDay');
  missingFields.push('currentProtocolDay');
} else {
  console.log(`✅ Has currentProtocolDay: ${cachedData.currentProtocolDay}`);
}

console.log('\n📊 5. SUPPLY DATA CHECK:');
if (!cachedData.stakingData) {
  console.log('❌ Missing stakingData wrapper');
  missingFields.push('stakingData wrapper object');
} else {
  if (cachedData.totalSupply === undefined && cachedData.stakingData.totalSupply === undefined) {
    console.log('❌ Missing totalSupply');
    missingFields.push('totalSupply');
  } else {
    console.log('✅ Has supply data');
  }
}

console.log('\n📊 6. LP POSITION FIELDS CHECK:');
const lpPos = cachedData.uniswapV3?.lpPositions?.[0];
if (lpPos) {
  const expectedLPFields = ['claimableTorus', 'claimableTitanX', 'estimatedAPR', 'priceRange', 'amount0', 'amount1'];
  expectedLPFields.forEach(field => {
    if (lpPos[field] === undefined) {
      console.log(`❌ LP positions missing: ${field}`);
      missingFields.push(`LP position field: ${field}`);
    }
  });
  console.log('✅ Checked LP position fields');
} else {
  console.log('⚠️  No LP positions to check fields');
}

console.log('\n📊 7. CREATE EVENT FIELDS CHECK:');
const createEvent = cachedData.stakingData?.createEvents?.[0];
if (createEvent) {
  if (!createEvent.titanAmount && !createEvent.costTitanX) {
    console.log('❌ Create events missing titanAmount field');
    missingFields.push('create event titanAmount');
  }
  if (!createEvent.shares) {
    console.log('❌ Create events missing shares field');
    missingFields.push('create event shares');
  }
} else {
  console.log('⚠️  No create events to check');
}

console.log('\n📊 8. REWARD POOL DETAILED CHECK:');
const rewardData = cachedData.rewardPoolData?.[0];
if (rewardData) {
  const expectedRewardFields = ['totalShares', 'penaltiesInPool'];
  expectedRewardFields.forEach(field => {
    if (rewardData[field] === undefined) {
      console.log(`❌ Reward pool missing: ${field}`);
      missingFields.push(`Reward pool field: ${field}`);
    }
  });
} else {
  console.log('⚠️  No reward data to check');
}

console.log('\n📊 9. METADATA FIELDS CHECK:');
if (!cachedData.metadata?.dataSource) {
  console.log('❌ Missing metadata.dataSource');
  missingFields.push('metadata.dataSource');
}
if (cachedData.metadata?.fallbackToRPC === undefined) {
  console.log('❌ Missing metadata.fallbackToRPC');
  missingFields.push('metadata.fallbackToRPC');
}

console.log('\n📋 SUMMARY:');
if (missingFields.length === 0) {
  console.log('✅ All frontend fields are present!');
} else {
  console.log(`❌ Missing ${missingFields.length} fields needed by frontend:`);
  missingFields.forEach(field => console.log(`  - ${field}`));
  
  console.log('\n📝 FIELDS TO ADD TO UPDATE SCRIPT:');
  console.log('1. Historical data (volume, fees, TVL for 7/30 days)');
  console.log('2. Contract data (token addresses, decimals)');
  console.log('3. Token prices (TORUS/TitanX USD prices)');
  console.log('4. LP position additional fields (claimable, APR, amounts)');
  console.log('5. Create event titanAmount and shares fields');
  console.log('6. Reward pool totalShares and penalties');
  console.log('7. Total supply and burned supply');
}