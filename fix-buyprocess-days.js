const fs = require('fs');
const path = require('path');

// Load current data
const dataPath = path.join(__dirname, 'public/data/buy-process-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// The actual data from blockchain shows:
// Day 17: 38 BuyAndBurn, 20 BuyAndBuild, 242.56 TORUS, 8369287195.03 TitanX
// Day 18: 24 BuyAndBurn, 10 BuyAndBuild, 218.49 TORUS, 7580825370.62 TitanX  
// Day 19: 10 BuyAndBurn, 4 BuyAndBuild, 47.29 TORUS, 1132036515.34 TitanX

// Fix Day 17
const day17 = data.dailyData.find(d => d.protocolDay === 17);
if (day17) {
  day17.buyAndBurnCount = 38;
  day17.buyAndBuildCount = 20;
  day17.torusBurned = 242.56;
  day17.titanXUsed = 8369287195.03;
  day17.titanXUsedForBurns = 8369287195.03;
  console.log('Fixed Day 17');
}

// Fix Day 18
const day18 = data.dailyData.find(d => d.protocolDay === 18);
if (day18) {
  day18.buyAndBurnCount = 24;
  day18.buyAndBuildCount = 10;
  day18.torusBurned = 218.49;
  day18.titanXUsed = 7580825370.62;
  day18.titanXUsedForBurns = 7580825370.62;
  console.log('Fixed Day 18');
}

// Fix Day 19
const day19 = data.dailyData.find(d => d.protocolDay === 19);
if (day19) {
  day19.buyAndBurnCount = 10;
  day19.buyAndBuildCount = 4;
  day19.torusBurned = 47.29;
  day19.titanXUsed = 1132036515.34;
  day19.titanXUsedForBurns = 1132036515.34;
  console.log('Fixed Day 19');
}

// Update timestamp
data.lastUpdated = new Date().toISOString();

// Write back
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('\nSuccessfully fixed days 17, 18, and 19 with correct event counts and amounts');