#!/usr/bin/env node

/**
 * Test LP Position Standardization
 */

const path = require('path');

// Add src directory to module paths
const srcPath = path.join(__dirname, '../src');
const scriptsPath = path.join(__dirname, '../scripts');

// Load modules with absolute paths
const { standardizeLPPosition, validateLPPosition } = require(path.join(srcPath, 'utils/lpPositionContract'));
const { standardizeLPPositions, safeMergeLPPositions } = require(path.join(scriptsPath, 'shared/useLPPositionStandard'));

// Simple test runner for Node.js
function runTests() {
  let passed = 0;
  let failed = 0;
  
  const expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toBeGreaterThan: (value) => {
      if (!(actual > value)) {
        throw new Error(`Expected ${actual} to be greater than ${value}`);
      }
    }
  });

  const test = (name, fn) => {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}: ${error.message}`);
      failed++;
    }
  };

  // Test 1: standardizeLPPosition converts various formats
  test('standardizeLPPosition converts various formats', () => {
    // Test amount0/1 format
    const oldFormat = {
      tokenId: '123',
      owner: '0x1234567890123456789012345678901234567890',
      amount0: 100,
      amount1: 200,
      liquidity: '1000',
      tickLower: -100,
      tickUpper: 100
    };
    
    const result = standardizeLPPosition(oldFormat);
    expect(result.torusAmount).toBe(100);
    expect(result.titanxAmount).toBe(200);
    expect(result.tokenId).toBe('123');
  });
  
  // Test 2: validateLPPosition catches invalid data
  test('validateLPPosition catches invalid data', () => {
    const invalid = {
      tokenId: '123',
      owner: 'not-an-address',
      torusAmount: 100,
      titanxAmount: 200,
      liquidity: '1000',
      tickLower: -100,
      tickUpper: 100,
      inRange: true
    };
    
    const { isValid, errors } = validateLPPosition(invalid);
    expect(isValid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });
  
  // Test 3: safeMergeLPPositions preserves non-zero amounts
  test('safeMergeLPPositions preserves non-zero amounts', () => {
    const existing = [{
      tokenId: '123',
      owner: '0x1234567890123456789012345678901234567890',
      torusAmount: 100,
      titanxAmount: 200,
      liquidity: '1000',
      tickLower: -100,
      tickUpper: 100,
      inRange: true
    }];
    
    const newData = [{
      tokenId: '123',
      owner: '0x1234567890123456789012345678901234567890',
      torusAmount: 0,
      titanxAmount: 0,
      liquidity: '1000',
      tickLower: -100,
      tickUpper: 100,
      inRange: false
    }];
    
    const merged = safeMergeLPPositions(newData, existing);
    
    // Should preserve the non-zero amounts
    expect(merged[0].torusAmount).toBe(100);
    expect(merged[0].titanxAmount).toBe(200);
    // But update other fields
    expect(merged[0].inRange).toBe(false);
  });
  
  // Test 4: standardizeLPPositions handles batch conversion
  test('standardizeLPPositions handles batch conversion', () => {
    const positions = [
      { tokenId: '1', amount0: 10, amount1: 20, liquidity: '100', tickLower: -100, tickUpper: 100 },
      { tokenId: '2', torusAmount: 30, titanxAmount: 40, liquidity: '200', tickLower: -200, tickUpper: 200 }
    ];
    
    const result = standardizeLPPositions(positions);
    
    expect(result[0].torusAmount).toBe(10);
    expect(result[0].titanxAmount).toBe(20);
    expect(result[1].torusAmount).toBe(30);
    expect(result[1].titanxAmount).toBe(40);
  });
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Run if executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}