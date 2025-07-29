const fs = require('fs');
const path = require('path');

// Fix Day 19 data with correct ETH values from blockchain verification
const dataPath = path.join(__dirname, 'public/data/buy-process-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Find Day 19
const day19 = data.dailyData.find(d => d.protocolDay === 19);

if (day19) {
  console.log("Current Day 19 data:");
  console.log(`  BuyAndBurn: ${day19.buyAndBurnCount} events`);
  console.log(`  BuyAndBuild: ${day19.buyAndBuildCount} events`);
  console.log(`  ETH used for burns: ${day19.ethUsedForBurns} ETH`);
  console.log(`  ETH used for builds: ${day19.ethUsedForBuilds} ETH`);
  console.log();

  // Update with correct blockchain data
  day19.buyAndBurnCount = 13; // Blockchain shows 13 burns, not 10
  day19.buyAndBuildCount = 7;  // Blockchain shows 7 builds, not 4
  day19.ethUsedForBurns = 0.082497; // Total ETH used in burns
  day19.ethUsedForBuilds = 0; // ETH builds had 0 value
  day19.ethUsed = day19.ethUsedForBurns + day19.ethUsedForBuilds;

  console.log("Updated Day 19 data:");
  console.log(`  BuyAndBurn: ${day19.buyAndBurnCount} events`);
  console.log(`  BuyAndBuild: ${day19.buyAndBuildCount} events`);
  console.log(`  ETH used for burns: ${day19.ethUsedForBurns} ETH`);
  console.log(`  ETH used for builds: ${day19.ethUsedForBuilds} ETH`);
  console.log(`  Total ETH used: ${day19.ethUsed} ETH`);

  // Update timestamp
  data.lastUpdated = new Date().toISOString();

  // Save the corrected data
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log("\n✅ Day 19 ETH data corrected and saved!");
  console.log("🔍 This confirms that ETH detection is still failing silently");
  console.log("📝 The enhanced scripts should prevent this in future updates");
} else {
  console.log("❌ Day 19 not found in data");
}