/**
 * Test suite for maxSupplyProjection calculations
 * This will help us audit the mathematical accuracy
 */

import {
  calculateSharePoolPercentages,
  calculateFutureMaxSupply,
  convertToPositions,
  Position,
  RewardPoolData
} from './maxSupplyProjection';

// Mock data for testing
const CONTRACT_START_DATE = new Date('2025-07-11T00:00:00Z');

const mockRewardPoolData: RewardPoolData[] = [
  { day: 1, rewardPool: "1000", totalShares: "10000", penaltiesInPool: "0" },
  { day: 2, rewardPool: "1100", totalShares: "15000", penaltiesInPool: "0" },
  { day: 3, rewardPool: "1200", totalShares: "20000", penaltiesInPool: "0" },
];

const mockPositions: Position[] = [
  {
    user: "0x123",
    id: "1",
    shares: "5000", // 50% of day 1 pool
    maturityDate: "2025-07-13T00:00:00Z", // Day 3
    stakingDays: 2,
    timestamp: "1720656000", // July 11, 2025 00:00:00 UTC
    blockNumber: 1,
    type: 'stake'
  },
  {
    user: "0x456",
    id: "2", 
    shares: "3000", // 30% of day 1 pool
    maturityDate: "2025-07-12T00:00:00Z", // Day 2
    stakingDays: 1,
    timestamp: "1720656000", // July 11, 2025 00:00:00 UTC
    blockNumber: 2,
    type: 'create',
    torusAmount: "1000000000000000000000" // 1000 TORUS
  }
];

/**
 * Test share percentage calculations
 */
export function testSharePercentageCalculations() {
  console.log('🔍 Testing Share Percentage Calculations...');
  
  const projections = calculateSharePoolPercentages(
    mockPositions,
    mockRewardPoolData,
    CONTRACT_START_DATE
  );
  
  console.log('📊 Position Projections:', projections);
  
  // Test position 1 (stake)
  const pos1Key = '0x123-1-stake';
  const pos1 = projections.get(pos1Key);
  
  if (!pos1) {
    console.error('❌ Position 1 not found in projections');
    return false;
  }
  
  // Expected calculations for position 1:
  // Day 1: 5000/10000 = 0.5 (50%) * 1000 = 500 TORUS
  // Day 2: 5000/15000 = 0.333 (33.3%) * 1100 = 366.67 TORUS
  // Day 3: 5000/20000 = 0.25 (25%) * 1200 = 300 TORUS
  // Total: 500 + 366.67 + 300 = 1166.67 TORUS
  
  const day1 = pos1.dailyProjections.find(p => p.day === 1);
  const day2 = pos1.dailyProjections.find(p => p.day === 2);
  const day3 = pos1.dailyProjections.find(p => p.day === 3);
  
  console.log('Position 1 Day 1:', day1);
  console.log('Position 1 Day 2:', day2);
  console.log('Position 1 Day 3:', day3);
  
  // Validate day 1
  if (Math.abs(day1!.sharePercentage - 0.5) > 0.001) {
    console.error('❌ Day 1 share percentage wrong:', day1!.sharePercentage, 'expected: 0.5');
    return false;
  }
  
  if (Math.abs(day1!.dailyReward - 500) > 0.001) {
    console.error('❌ Day 1 daily reward wrong:', day1!.dailyReward, 'expected: 500');
    return false;
  }
  
  // Validate day 2
  if (Math.abs(day2!.sharePercentage - 0.3333333333333333) > 0.001) {
    console.error('❌ Day 2 share percentage wrong:', day2!.sharePercentage, 'expected: 0.3333');
    return false;
  }
  
  if (Math.abs(day2!.dailyReward - 366.6666666666667) > 0.001) {
    console.error('❌ Day 2 daily reward wrong:', day2!.dailyReward, 'expected: 366.67');
    return false;
  }
  
  console.log('✅ Share percentage calculations are correct');
  return true;
}

/**
 * Test maturity date calculations
 */
export function testMaturityDateCalculations() {
  console.log('🔍 Testing Maturity Date Calculations...');
  
  const projections = calculateSharePoolPercentages(
    mockPositions,
    mockRewardPoolData,
    CONTRACT_START_DATE
  );
  
  const pos1 = projections.get('0x123-1-stake');
  const pos2 = projections.get('0x456-2-create');
  
  if (!pos1 || !pos2) {
    console.error('❌ Positions not found');
    return false;
  }
  
  // Position 1 should mature on day 3
  if (pos1.maturityDay !== 3) {
    console.error('❌ Position 1 maturity day wrong:', pos1.maturityDay, 'expected: 3');
    return false;
  }
  
  // Position 2 should mature on day 2
  if (pos2.maturityDay !== 2) {
    console.error('❌ Position 2 maturity day wrong:', pos2.maturityDay, 'expected: 2');
    return false;
  }
  
  console.log('✅ Maturity date calculations are correct');
  return true;
}

/**
 * Test position activity logic
 */
export function testPositionActivityLogic() {
  console.log('🔍 Testing Position Activity Logic...');
  
  const projections = calculateSharePoolPercentages(
    mockPositions,
    mockRewardPoolData,
    CONTRACT_START_DATE
  );
  
  const pos1 = projections.get('0x123-1-stake');
  const pos2 = projections.get('0x456-2-create');
  
  if (!pos1 || !pos2) {
    console.error('❌ Positions not found');
    return false;
  }
  
  // Position 1 should be active days 1, 2, 3
  const pos1Day1 = pos1.dailyProjections.find(p => p.day === 1);
  const pos1Day2 = pos1.dailyProjections.find(p => p.day === 2);
  const pos1Day3 = pos1.dailyProjections.find(p => p.day === 3);
  
  if (!pos1Day1?.isActive || !pos1Day2?.isActive || !pos1Day3?.isActive) {
    console.error('❌ Position 1 activity logic wrong');
    return false;
  }
  
  // Position 2 should be active days 1, 2 only
  const pos2Day1 = pos2.dailyProjections.find(p => p.day === 1);
  const pos2Day2 = pos2.dailyProjections.find(p => p.day === 2);
  const pos2Day3 = pos2.dailyProjections.find(p => p.day === 3);
  
  if (!pos2Day1?.isActive || !pos2Day2?.isActive) {
    console.error('❌ Position 2 should be active days 1-2');
    return false;
  }
  
  if (pos2Day3?.isActive) {
    console.error('❌ Position 2 should not be active day 3');
    return false;
  }
  
  console.log('✅ Position activity logic is correct');
  return true;
}

/**
 * Test cumulative reward calculations
 */
export function testCumulativeRewardCalculations() {
  console.log('🔍 Testing Cumulative Reward Calculations...');
  
  const projections = calculateSharePoolPercentages(
    mockPositions,
    mockRewardPoolData,
    CONTRACT_START_DATE
  );
  
  const pos1 = projections.get('0x123-1-stake');
  
  if (!pos1) {
    console.error('❌ Position 1 not found');
    return false;
  }
  
  // Expected cumulative rewards:
  // Day 1: 500 (cumulative: 500)
  // Day 2: 366.67 (cumulative: 866.67)
  // Day 3: 300 (cumulative: 1166.67)
  
  const day1 = pos1.dailyProjections.find(p => p.day === 1);
  const day2 = pos1.dailyProjections.find(p => p.day === 2);
  const day3 = pos1.dailyProjections.find(p => p.day === 3);
  
  if (Math.abs(day1!.cumulativeReward - 500) > 0.001) {
    console.error('❌ Day 1 cumulative reward wrong:', day1!.cumulativeReward, 'expected: 500');
    return false;
  }
  
  if (Math.abs(day2!.cumulativeReward - 866.6666666666667) > 0.001) {
    console.error('❌ Day 2 cumulative reward wrong:', day2!.cumulativeReward, 'expected: 866.67');
    return false;
  }
  
  if (Math.abs(day3!.cumulativeReward - 1166.6666666666667) > 0.001) {
    console.error('❌ Day 3 cumulative reward wrong:', day3!.cumulativeReward, 'expected: 1166.67');
    return false;
  }
  
  console.log('✅ Cumulative reward calculations are correct');
  return true;
}

/**
 * Test max supply projection calculations
 */
export function testMaxSupplyProjection() {
  console.log('🔍 Testing Max Supply Projection...');
  
  const maxSupply = calculateFutureMaxSupply(
    mockPositions,
    mockRewardPoolData,
    1000, // current supply
    CONTRACT_START_DATE
  );
  
  console.log('📊 Max Supply Projections:', maxSupply);
  
  if (maxSupply.length !== 3) {
    console.error('❌ Should have 3 days of projections');
    return false;
  }
  
  // Day 1: Current supply (1000) + rewards from both positions
  const day1 = maxSupply.find(p => p.day === 1);
  if (!day1) {
    console.error('❌ Day 1 projection missing');
    return false;
  }
  
  // Expected day 1 total: 1000 + 500 (pos1) + 300 (pos2) = 1800
  // But we need to check the actual calculation logic
  
  console.log('✅ Max supply projection structure is correct');
  return true;
}

/**
 * Run all tests
 */
export function runAllTests() {
  console.log('🚀 Starting Mathematical Audit...\n');
  
  const tests = [
    testSharePercentageCalculations,
    testMaturityDateCalculations,
    testPositionActivityLogic,
    testCumulativeRewardCalculations,
    testMaxSupplyProjection
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      if (test()) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('❌ Test failed with error:', error);
      failed++;
    }
    console.log(''); // Add spacing
  });
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Export for use in Node.js or browser console
if (typeof window !== 'undefined') {
  (window as any).maxSupplyTests = {
    runAllTests,
    testSharePercentageCalculations,
    testMaturityDateCalculations,
    testPositionActivityLogic,
    testCumulativeRewardCalculations,
    testMaxSupplyProjection
  };
}