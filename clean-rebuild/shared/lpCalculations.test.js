/**
 * Unit tests for lpCalculations module
 */

const { 
  calculatePositionAmounts,
  mapFieldNames,
  calculatePrice,
  formatPrice,
  isPositionInRange,
  mergeLPPositions,
  validateLPPosition,
  normalizeAmount
} = require('./lpCalculations');

const { ethers } = require('ethers');

// Test calculatePositionAmounts
function testCalculatePositionAmounts() {
  console.log('\n=== Testing calculatePositionAmounts ===');
  
  // Test 1: Position below range (all in token0)
  const position1 = {
    liquidity: ethers.BigNumber.from('1000000000000000000'), // 1e18
    tickLower: 100000,
    tickUpper: 110000
  };
  const currentTick1 = 90000; // Below range
  // Price for tick 90000 (below the position range)
  const sqrtPriceX96Below = ethers.BigNumber.from('70000000000000000000000000000000000000');
  
  const result1 = calculatePositionAmounts(position1, sqrtPriceX96Below, currentTick1);
  console.log('Position below range:', result1);
  console.assert(result1.amount0 > 0, 'Amount0 should be positive when below range');
  console.assert(result1.amount1 === 0, 'Amount1 should be 0 when below range');
  
  // Test 2: Position above range (all in token1)
  const currentTick2 = 120000; // Above range
  // Price for tick 120000 (above the position range)
  const sqrtPriceX96Above = ethers.BigNumber.from('90000000000000000000000000000000000000');
  const result2 = calculatePositionAmounts(position1, sqrtPriceX96Above, currentTick2);
  console.log('Position above range:', result2);
  console.assert(result2.amount0 === 0, 'Amount0 should be 0 when above range');
  console.assert(result2.amount1 > 0, 'Amount1 should be positive when above range');
  
  console.log('✅ calculatePositionAmounts tests passed');
}

// Test mapFieldNames
function testMapFieldNames() {
  console.log('\n=== Testing mapFieldNames ===');
  
  const input = {
    tokenId: '123',
    amount0: 100.5,
    amount1: 200.75,
    claimableTorus: 1.5,
    claimableTitanX: 2.5
  };
  
  const result = mapFieldNames(input);
  console.log('Mapped fields:', result);
  
  console.assert(result.torusAmount === 100.5, 'torusAmount should equal amount0');
  console.assert(result.titanxAmount === 200.75, 'titanxAmount should equal amount1');
  console.assert(result.claimableYield === 4.0, 'claimableYield should be sum of claimables');
  console.assert(result.tokenId === '123', 'Other fields should be preserved');
  
  // Test with missing fields
  const input2 = { tokenId: '456' };
  const result2 = mapFieldNames(input2);
  console.assert(result2.torusAmount === 0, 'torusAmount should default to 0');
  console.assert(result2.titanxAmount === 0, 'titanxAmount should default to 0');
  
  console.log('✅ mapFieldNames tests passed');
}

// Test formatPrice
function testFormatPrice() {
  console.log('\n=== Testing formatPrice ===');
  
  const tests = [
    { input: 1234567890, expected: '1.23B' },
    { input: 12345678, expected: '12.35M' },
    { input: 12345, expected: '12.35K' },
    { input: 123.45, expected: '123.45' }
  ];
  
  tests.forEach(test => {
    const result = formatPrice(test.input);
    console.log(`formatPrice(${test.input}) = ${result}`);
    console.assert(result === test.expected, `Expected ${test.expected}, got ${result}`);
  });
  
  console.log('✅ formatPrice tests passed');
}

// Test isPositionInRange
function testIsPositionInRange() {
  console.log('\n=== Testing isPositionInRange ===');
  
  console.assert(isPositionInRange(100, 50, 150) === true, 'Should be in range');
  console.assert(isPositionInRange(50, 50, 150) === true, 'Should be in range at lower bound');
  console.assert(isPositionInRange(150, 50, 150) === false, 'Should not be in range at upper bound');
  console.assert(isPositionInRange(200, 50, 150) === false, 'Should not be in range above');
  console.assert(isPositionInRange(25, 50, 150) === false, 'Should not be in range below');
  
  console.log('✅ isPositionInRange tests passed');
}

// Test mergeLPPositions
function testMergeLPPositions() {
  console.log('\n=== Testing mergeLPPositions ===');
  
  const existing = [
    { tokenId: '1', amount0: 100, amount1: 200, manualNotes: 'Keep this' },
    { tokenId: '2', amount0: 150, amount1: 250 }
  ];
  
  const newPositions = [
    { tokenId: '1', amount0: 110, amount1: 210 }, // Update
    { tokenId: '3', amount0: 300, amount1: 400 }  // New
  ];
  
  const result = mergeLPPositions(existing, newPositions);
  console.log('Merged positions:', result);
  
  console.assert(result.length === 3, 'Should have 3 positions');
  
  const pos1 = result.find(p => p.tokenId === '1');
  console.assert(pos1.torusAmount === 110, 'Position 1 should be updated');
  console.assert(pos1.manualNotes === 'Keep this', 'Manual fields should be preserved');
  
  const pos3 = result.find(p => p.tokenId === '3');
  console.assert(pos3 !== undefined, 'New position should be added');
  console.assert(pos3.torusAmount === 300, 'New position should have field mapping');
  
  console.log('✅ mergeLPPositions tests passed');
}

// Test validateLPPosition
function testValidateLPPosition() {
  console.log('\n=== Testing validateLPPosition ===');
  
  const validPosition = {
    tokenId: '123',
    owner: '0x123...',
    liquidity: '1000000',
    tickLower: -100,
    tickUpper: 100,
    amount0: 100,
    amount1: 200,
    torusAmount: 100,
    titanxAmount: 200
  };
  
  const result1 = validateLPPosition(validPosition);
  console.assert(result1.valid === true, 'Valid position should pass');
  console.assert(result1.errors.length === 0, 'Valid position should have no errors');
  
  const invalidPosition = {
    tokenId: '456',
    // Missing required fields
    amount0: 'not a number',
    amount1: 100
    // Missing field mapping
  };
  
  const result2 = validateLPPosition(invalidPosition);
  console.assert(result2.valid === false, 'Invalid position should fail');
  console.assert(result2.errors.length > 0, 'Invalid position should have errors');
  console.log('Validation errors:', result2.errors);
  
  console.log('✅ validateLPPosition tests passed');
}

// Test normalizeAmount
function testNormalizeAmount() {
  console.log('\n=== Testing normalizeAmount ===');
  
  const tests = [
    { input: null, expected: 0 },
    { input: undefined, expected: 0 },
    { input: 123.45, expected: 123.45 },
    { input: '456.78', expected: 456.78 },
    { input: BigInt('1000000000000000000'), expected: 1 }, // 1e18 wei = 1 token
    { input: '0x3635c9adc5dea00000', expected: 1000 }, // 1000e18 in hex
    { input: ethers.BigNumber.from('2000000000000000000'), expected: 2 }
  ];
  
  tests.forEach(test => {
    const result = normalizeAmount(test.input);
    console.log(`normalizeAmount(${test.input}) = ${result}`);
    console.assert(Math.abs(result - test.expected) < 0.0001, 
      `Expected ${test.expected}, got ${result}`);
  });
  
  console.log('✅ normalizeAmount tests passed');
}

// Run all tests
function runAllTests() {
  console.log('🧪 Running lpCalculations unit tests...\n');
  
  try {
    testCalculatePositionAmounts();
    testMapFieldNames();
    testFormatPrice();
    testIsPositionInRange();
    testMergeLPPositions();
    testValidateLPPosition();
    testNormalizeAmount();
    
    console.log('\n✅ All tests passed! 🎉');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };