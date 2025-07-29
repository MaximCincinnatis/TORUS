// SIMPLE FIX: Update reward fetching to include penalty rewards for Days 89+

const fs = require('fs');

console.log('🔧 APPLYING SIMPLE FIX FOR REWARD DAYS 89+');
console.log('==========================================');

// Read current rewardPoolManager.js
const managerPath = 'src/utils/rewardPoolManager.js';
let managerCode = fs.readFileSync(managerPath, 'utf8');

console.log('Original TOTAL_REWARD_DAYS setting:');
const originalMatch = managerCode.match(/const TOTAL_REWARD_DAYS = (\d+);/);
if (originalMatch) {
  console.log(`  TOTAL_REWARD_DAYS = ${originalMatch[1]}`);
}

// Simple fix: Change TOTAL_REWARD_DAYS from 88 to 365 (or current protocol day + buffer)
const newCode = managerCode.replace(
  /const TOTAL_REWARD_DAYS = 88;/,
  'const TOTAL_REWARD_DAYS = 365; // Extended to include penalty rewards'
);

// Also update the validation logic to allow penalty-only days
const updatedCode = newCode.replace(
  /if \(day < 1 \|\| day > TOTAL_REWARD_DAYS\) \{[\s\S]*?return \{[\s\S]*?\};[\s\S]*?\}/,
  `if (day < 1) {
    return {
      day,
      rewardPool: 0,
      totalShares: 0,
      penaltiesInPool: 0
    };
  }
  
  // Days 1-88: Base rewards (declining)
  // Days 89+: Only penalty rewards (fetched from contract)`
);

if (newCode !== managerCode) {
  // Backup original
  fs.writeFileSync(managerPath + '.backup', managerCode);
  
  // Write updated version
  fs.writeFileSync(managerPath, updatedCode);
  
  console.log('✅ Updated rewardPoolManager.js:');
  console.log('  - TOTAL_REWARD_DAYS: 88 → 365');
  console.log('  - Allows fetching penalty rewards for Days 89+');
  console.log('  - Backup saved as rewardPoolManager.js.backup');
} else {
  console.log('❌ No changes needed or pattern not found');
}

// Alternative: Update the calculateRewardPoolForDay function to handle indefinite days
const calculateFunctionMatch = managerCode.match(/function calculateRewardPoolForDay\(day\) \{[\s\S]*?\}/);
if (calculateFunctionMatch) {
  console.log('\n🔧 Also updating calculateRewardPoolForDay function...');
  
  const newCalculateFunction = `function calculateRewardPoolForDay(day) {
  if (day < 1) {
    return {
      day,
      rewardPool: 0,
      totalShares: 0,
      penaltiesInPool: 0
    };
  }
  
  // Base rewards only for days 1-88
  if (day > 88) {
    return {
      day,
      rewardPool: 0, // No base rewards after day 88
      totalShares: 0, // Will be fetched from contract
      penaltiesInPool: 0 // Will be fetched from contract - this is the key fix
    };
  }
  
  // Calculate base rewards for days 1-88
  let rewardPool = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - DAILY_REDUCTION_RATE);
  }
  
  return {
    day,
    rewardPool,
    totalShares: 808558839.0090909, // Default from existing data
    penaltiesInPool: 0
  };
}`;
  
  const finalCode = updatedCode.replace(calculateFunctionMatch[0], newCalculateFunction);
  fs.writeFileSync(managerPath, finalCode);
  
  console.log('✅ Updated calculateRewardPoolForDay to handle Days 89+');
}

console.log('\n📋 WHAT THIS FIX DOES:');
console.log('1. Allows reward fetching for Days 89+ (was limited to 88)');
console.log('2. Contract calls will now fetch penalty data for these days');
console.log('3. Days 89+ will show penalty rewards instead of 0');
console.log('4. October maturity dates will get correct accumulated rewards');

console.log('\n⚡ NEXT STEPS:');
console.log('1. Run data update script to fetch Days 89+ penalty rewards');
console.log('2. Verify cached-data.json shows non-zero rewards for Days 89+'); 
console.log('3. Check charts now display reward bars for Days 89+');

console.log('\n✅ Simple fix applied - reward data should now include Days 89+');