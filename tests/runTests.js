#!/usr/bin/env node

/**
 * Simple test runner for LP calculations
 */

const { ethers } = require('ethers');
const {
  calculatePositionAmounts,
  calculateClaimableFees,
  mapFieldNames,
  mergeLPPositions
} = require('../shared/lpCalculations');

// Test data
const TEST_POSITIONS = {
  fullRange: {
    tokenId: '1029195',
    liquidity: '1000000000000000000', // 1e18
    tickLower: -887220,
    tickUpper: 887220,
    tokensOwed0: '1000000000000000000', // 1 TORUS
    tokensOwed1: '1000000000000000000000' // 1000 TITANX
  },
  concentrated: {
    tokenId: '1032346',
    liquidity: '500000000000000000', // 0.5e18
    tickLower: -10,
    tickUpper: 10,
    tokensOwed0: '500000000000000000', // 0.5 TORUS
    tokensOwed1: '500000000000000000000' // 500 TITANX
  },
  outOfRange: {
    tokenId: '999999',
    liquidity: '2000000000000000000', // 2e18
    tickLower: 100000,
    tickUpper: 200000,
    tokensOwed0: '0',
    tokensOwed1: '0'
  }
};

// Current pool state (approximate)
const POOL_STATE = {
  sqrtPriceX96: ethers.BigNumber.from('79228162514264337593543950336'), // ~1 TITANX per TORUS
  currentTick: 0 // Near 1:1 price
};

console.log('🧪 Running LP Calculation Tests\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: Calculate full range position
test('Calculate full range position amounts', () => {
  const amounts = calculatePositionAmounts(
    TEST_POSITIONS.fullRange,
    POOL_STATE.sqrtPriceX96,
    POOL_STATE.currentTick
  );
  
  assert(amounts.amount0 > 0, 'amount0 should be > 0');
  assert(amounts.amount1 > 0, 'amount1 should be > 0');
  console.log(`   Full range: ${amounts.amount0.toFixed(4)} TORUS, ${amounts.amount1.toFixed(4)} TITANX`);
});

// Test 2: Calculate concentrated position
test('Calculate concentrated position amounts', () => {
  const amounts = calculatePositionAmounts(
    TEST_POSITIONS.concentrated,
    POOL_STATE.sqrtPriceX96,
    POOL_STATE.currentTick
  );
  
  // Check if position is in range
  const inRange = POOL_STATE.currentTick >= TEST_POSITIONS.concentrated.tickLower && 
                  POOL_STATE.currentTick < TEST_POSITIONS.concentrated.tickUpper;
  
  if (inRange) {
    assert(amounts.amount0 > 0, 'amount0 should be > 0 when in range');
    assert(amounts.amount1 > 0, 'amount1 should be > 0 when in range');
  } else {
    // Position is out of range, one amount should be 0
    assert(amounts.amount0 >= 0 && amounts.amount1 >= 0, 'amounts should be non-negative');
  }
  console.log(`   Concentrated: ${amounts.amount0.toFixed(4)} TORUS, ${amounts.amount1.toFixed(4)} TITANX (in range: ${inRange})`);
});

// Test 3: Calculate out of range position
test('Calculate out of range position amounts', () => {
  const amounts = calculatePositionAmounts(
    TEST_POSITIONS.outOfRange,
    POOL_STATE.sqrtPriceX96,
    POOL_STATE.currentTick
  );
  
  assert(amounts.amount0 > 0, 'amount0 should be > 0');
  assert(amounts.amount1 === 0, 'amount1 should be 0 when below range');
  console.log(`   Out of range: ${amounts.amount0.toFixed(4)} TORUS, ${amounts.amount1.toFixed(4)} TITANX`);
});

// Test 4: Zero liquidity
test('Handle zero liquidity positions', () => {
  const zeroLiqPosition = {
    ...TEST_POSITIONS.fullRange,
    liquidity: '0'
  };
  
  const amounts = calculatePositionAmounts(
    zeroLiqPosition,
    POOL_STATE.sqrtPriceX96,
    POOL_STATE.currentTick
  );
  
  assert(amounts.amount0 === 0, 'amount0 should be 0');
  assert(amounts.amount1 === 0, 'amount1 should be 0');
});

// Test 5: Field mapping
test('Map amount0/amount1 to torusAmount/titanxAmount', () => {
  const input = {
    tokenId: '12345',
    amount0: 1.5,
    amount1: 1500,
    owner: '0xabc'
  };
  
  const mapped = mapFieldNames(input);
  
  assert(mapped.torusAmount === 1.5, 'torusAmount should equal amount0');
  assert(mapped.titanxAmount === 1500, 'titanxAmount should equal amount1');
  assert(!('amount0' in mapped), 'amount0 should be removed');
  assert(!('amount1' in mapped), 'amount1 should be removed');
});

// Test 6: Preserve existing field names
test('Preserve existing torusAmount/titanxAmount fields', () => {
  const input = {
    tokenId: '12345',
    torusAmount: 2.5,
    titanxAmount: 2500,
    owner: '0xabc'
  };
  
  const mapped = mapFieldNames(input);
  
  assert(mapped.torusAmount === 2.5, 'torusAmount should be preserved');
  assert(mapped.titanxAmount === 2500, 'titanxAmount should be preserved');
});

// Test 7: Merge positions
test('Merge LP positions correctly', () => {
  const existing = [
    { tokenId: '1', torusAmount: 1, titanxAmount: 1000, liquidity: '1000' },
    { tokenId: '2', torusAmount: 2, titanxAmount: 2000, liquidity: '2000' }
  ];
  
  const updates = [
    { tokenId: '2', torusAmount: 2.5, titanxAmount: 2500, liquidity: '2000' }, // Update
    { tokenId: '3', torusAmount: 3, titanxAmount: 3000, liquidity: '3000' }   // New
  ];
  
  const merged = mergeLPPositions(existing, updates);
  
  assert(merged.length === 3, 'Should have 3 positions');
  assert(merged.find(p => p.tokenId === '2').torusAmount === 2.5, 'Position 2 should be updated');
  assert(merged.find(p => p.tokenId === '3'), 'Position 3 should be added');
});

// Test 8: Preserve non-zero values
test('Preserve non-zero amounts when update has zeros', () => {
  const existing = [
    { tokenId: '1', torusAmount: 1.5, titanxAmount: 1500, liquidity: '1000' }
  ];
  
  const updates = [
    { tokenId: '1', torusAmount: 0, titanxAmount: 0, liquidity: '1000' }
  ];
  
  const merged = mergeLPPositions(existing, updates);
  
  assert(merged.length === 1, 'Should have 1 position');
  assert(merged[0].torusAmount === 1.5, 'torusAmount should be preserved');
  assert(merged[0].titanxAmount === 1500, 'titanxAmount should be preserved');
});

// Test 9: Remove zero liquidity positions
test('Remove positions with zero liquidity', () => {
  const existing = [
    { tokenId: '1', torusAmount: 1, titanxAmount: 1000, liquidity: '1000' },
    { tokenId: '2', torusAmount: 2, titanxAmount: 2000, liquidity: '2000' }
  ];
  
  const updates = [
    { tokenId: '2', torusAmount: 0, titanxAmount: 0, liquidity: '0' }
  ];
  
  const merged = mergeLPPositions(existing, updates);
  
  assert(merged.length === 1, 'Should have 1 position');
  assert(merged[0].tokenId === '1', 'Only position 1 should remain');
});

// Test 10: Integration test
test('Full calculation pipeline integration', () => {
  // Calculate amounts
  const amounts = calculatePositionAmounts(
    TEST_POSITIONS.fullRange,
    POOL_STATE.sqrtPriceX96,
    POOL_STATE.currentTick
  );
  
  // Create position object
  const position = {
    ...TEST_POSITIONS.fullRange,
    amount0: amounts.amount0,
    amount1: amounts.amount1,
    owner: '0x1234567890123456789012345678901234567890',
    fee: 10000,
    inRange: true,
    claimableTorus: 1,
    claimableTitanX: 1000,
    estimatedAPR: '25.5',
    priceRange: 'Full Range'
  };
  
  // Map field names
  const mapped = mapFieldNames(position);
  
  // Validate result
  assert(mapped.tokenId === '1029195', 'tokenId should match');
  assert(mapped.torusAmount > 0, 'torusAmount should be > 0');
  assert(mapped.titanxAmount > 0, 'titanxAmount should be > 0');
  assert(mapped.claimableTorus === 1, 'claimableTorus should match');
  assert(mapped.claimableTitanX === 1000, 'claimableTitanX should match');
  assert(!('amount0' in mapped), 'amount0 should be removed');
  assert(!('amount1' in mapped), 'amount1 should be removed');
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}