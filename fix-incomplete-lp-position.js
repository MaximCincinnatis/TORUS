const fs = require('fs');

console.log('Fixing incomplete LP position in cached data...');

const cacheFile = './public/data/cached-data.json';
const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

// Find and fix the incomplete position
data.lpPositions = data.lpPositions.map(position => {
  if (!position.amount0 && !position.amount1) {
    console.log(`Fixing incomplete position ${position.tokenId}`);
    return {
      ...position,
      amount0: 0,
      amount1: 0,
      inRange: false,
      claimableTorus: 0,
      claimableTitanX: 0,
      estimatedAPR: "0.00",
      priceRange: position.priceRange || "N/A",
      minTitanXPrice: 0,
      maxTitanXPrice: 0,
      lowerTitanxPerTorus: "0",
      upperTitanxPerTorus: "0",
      currentTitanxPerTorus: "0",
      tokensOwed0: "0",
      tokensOwed1: "0"
    };
  }
  return position;
});

// Update timestamp
data.lastUpdated = new Date().toISOString();

// Save the fixed data
fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));

console.log('✅ Fixed incomplete LP position data');
console.log(`Total positions: ${data.lpPositions.length}`);