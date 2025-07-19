/**
 * Tests for LP Position Calculations
 * 
 * Ensures calculations are correct and consistent
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
    tickLower: 276320,
    tickUpper: 276330,
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
  currentTick: 276324
};

describe('LP Position Calculations', () => {
  describe('calculatePositionAmounts', () => {
    test('calculates full range position correctly', () => {
      const amounts = calculatePositionAmounts(
        TEST_POSITIONS.fullRange,
        POOL_STATE.sqrtPriceX96,
        POOL_STATE.currentTick
      );
      
      expect(amounts.amount0).toBeGreaterThan(0);
      expect(amounts.amount1).toBeGreaterThan(0);
      console.log('Full range amounts:', amounts);
    });
    
    test('calculates concentrated position correctly', () => {
      const amounts = calculatePositionAmounts(
        TEST_POSITIONS.concentrated,
        POOL_STATE.sqrtPriceX96,
        POOL_STATE.currentTick
      );
      
      // Position is in range, should have both tokens
      expect(amounts.amount0).toBeGreaterThan(0);
      expect(amounts.amount1).toBeGreaterThan(0);
      console.log('Concentrated amounts:', amounts);
    });
    
    test('calculates out of range position correctly', () => {
      const amounts = calculatePositionAmounts(
        TEST_POSITIONS.outOfRange,
        POOL_STATE.sqrtPriceX96,
        POOL_STATE.currentTick
      );
      
      // Position is below current price, should be all in TORUS
      expect(amounts.amount0).toBeGreaterThan(0);
      expect(amounts.amount1).toBe(0);
      console.log('Out of range amounts:', amounts);
    });
    
    test('handles zero liquidity positions', () => {
      const zeroLiqPosition = {
        ...TEST_POSITIONS.fullRange,
        liquidity: '0'
      };
      
      const amounts = calculatePositionAmounts(
        zeroLiqPosition,
        POOL_STATE.sqrtPriceX96,
        POOL_STATE.currentTick
      );
      
      expect(amounts.amount0).toBe(0);
      expect(amounts.amount1).toBe(0);
    });
  });
  
  describe('mapFieldNames', () => {
    test('maps amount0/amount1 to torusAmount/titanxAmount', () => {
      const input = {
        tokenId: '12345',
        amount0: 1.5,
        amount1: 1500,
        owner: '0xabc'
      };
      
      const mapped = mapFieldNames(input);
      
      expect(mapped.torusAmount).toBe(1.5);
      expect(mapped.titanxAmount).toBe(1500);
      expect(mapped.amount0).toBeUndefined();
      expect(mapped.amount1).toBeUndefined();
    });
    
    test('preserves existing torusAmount/titanxAmount', () => {
      const input = {
        tokenId: '12345',
        torusAmount: 2.5,
        titanxAmount: 2500,
        owner: '0xabc'
      };
      
      const mapped = mapFieldNames(input);
      
      expect(mapped.torusAmount).toBe(2.5);
      expect(mapped.titanxAmount).toBe(2500);
    });
    
    test('handles missing amount fields', () => {
      const input = {
        tokenId: '12345',
        owner: '0xabc'
      };
      
      const mapped = mapFieldNames(input);
      
      expect(mapped.torusAmount).toBe(0);
      expect(mapped.titanxAmount).toBe(0);
    });
  });
  
  describe('mergeLPPositions', () => {
    test('merges positions without duplicates', () => {
      const existing = [
        { tokenId: '1', torusAmount: 1, titanxAmount: 1000 },
        { tokenId: '2', torusAmount: 2, titanxAmount: 2000 }
      ];
      
      const updates = [
        { tokenId: '2', torusAmount: 2.5, titanxAmount: 2500 }, // Update
        { tokenId: '3', torusAmount: 3, titanxAmount: 3000 }   // New
      ];
      
      const merged = mergeLPPositions(existing, updates);
      
      expect(merged.length).toBe(3);
      expect(merged.find(p => p.tokenId === '2').torusAmount).toBe(2.5);
    });
    
    test('preserves non-zero amounts when update has zeros', () => {
      const existing = [
        { tokenId: '1', torusAmount: 1.5, titanxAmount: 1500, liquidity: '1000' }
      ];
      
      const updates = [
        { tokenId: '1', torusAmount: 0, titanxAmount: 0, liquidity: '1000' }
      ];
      
      const merged = mergeLPPositions(existing, updates);
      
      expect(merged.length).toBe(1);
      expect(merged[0].torusAmount).toBe(1.5); // Preserved
      expect(merged[0].titanxAmount).toBe(1500); // Preserved
    });
    
    test('removes positions with zero liquidity', () => {
      const existing = [
        { tokenId: '1', torusAmount: 1, titanxAmount: 1000, liquidity: '1000' },
        { tokenId: '2', torusAmount: 2, titanxAmount: 2000, liquidity: '2000' }
      ];
      
      const updates = [
        { tokenId: '2', torusAmount: 0, titanxAmount: 0, liquidity: '0' } // Removed
      ];
      
      const merged = mergeLPPositions(existing, updates);
      
      expect(merged.length).toBe(1);
      expect(merged[0].tokenId).toBe('1');
    });
  });
  
  describe('Integration Tests', () => {
    test('full calculation pipeline', () => {
      // 1. Calculate amounts
      const amounts = calculatePositionAmounts(
        TEST_POSITIONS.fullRange,
        POOL_STATE.sqrtPriceX96,
        POOL_STATE.currentTick
      );
      
      // 2. Create position object
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
      
      // 3. Map field names
      const mapped = mapFieldNames(position);
      
      // 4. Validate result
      expect(mapped.tokenId).toBe('1029195');
      expect(mapped.torusAmount).toBeGreaterThan(0);
      expect(mapped.titanxAmount).toBeGreaterThan(0);
      expect(mapped.claimableTorus).toBe(1);
      expect(mapped.claimableTitanX).toBe(1000);
      expect(mapped.amount0).toBeUndefined();
      expect(mapped.amount1).toBeUndefined();
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('Running LP Calculation Tests...\n');
  
  // Simple test runner
  const tests = [];
  let currentSuite = '';
  let currentTest = '';
  
  global.describe = (name, fn) => {
    currentSuite = name;
    console.log(`\n${name}`);
    fn();
  };
  
  global.test = global.it = (name, fn) => {
    currentTest = name;
    tests.push({ suite: currentSuite, name, fn });
  };
  
  global.expect = (value) => ({
    toBe: (expected) => {
      if (value !== expected) {
        throw new Error(`Expected ${value} to be ${expected}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (!(value > expected)) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
    toBeUndefined: () => {
      if (value !== undefined) {
        throw new Error(`Expected ${value} to be undefined`);
      }
    }
  });
  
  // Load test definitions
  describe('LP Position Calculations', () => {
    describe('calculatePositionAmounts', () => {
      test('calculates full range position correctly', () => {
        const amounts = calculatePositionAmounts(
          TEST_POSITIONS.fullRange,
          POOL_STATE.sqrtPriceX96,
          POOL_STATE.currentTick
        );
        
        expect(amounts.amount0).toBeGreaterThan(0);
        expect(amounts.amount1).toBeGreaterThan(0);
        console.log('Full range amounts:', amounts);
      });
      
      test('calculates concentrated position correctly', () => {
        const amounts = calculatePositionAmounts(
          TEST_POSITIONS.concentrated,
          POOL_STATE.sqrtPriceX96,
          POOL_STATE.currentTick
        );
        
        // Position is in range, should have both tokens
        expect(amounts.amount0).toBeGreaterThan(0);
        expect(amounts.amount1).toBeGreaterThan(0);
        console.log('Concentrated amounts:', amounts);
      });
      
      test('calculates out of range position correctly', () => {
        const amounts = calculatePositionAmounts(
          TEST_POSITIONS.outOfRange,
          POOL_STATE.sqrtPriceX96,
          POOL_STATE.currentTick
        );
        
        // Position is below current price, should be all in TORUS
        expect(amounts.amount0).toBeGreaterThan(0);
        expect(amounts.amount1).toBe(0);
        console.log('Out of range amounts:', amounts);
      });
    });
    
    describe('mapFieldNames', () => {
      test('maps amount0/amount1 to torusAmount/titanxAmount', () => {
        const input = {
          tokenId: '12345',
          amount0: 1.5,
          amount1: 1500,
          owner: '0xabc'
        };
        
        const mapped = mapFieldNames(input);
        
        expect(mapped.torusAmount).toBe(1.5);
        expect(mapped.titanxAmount).toBe(1500);
        expect(mapped.amount0).toBeUndefined();
        expect(mapped.amount1).toBeUndefined();
      });
    });
  });
  
  // Run tests
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ suite, name, fn }) => {
    try {
      fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${name}`);
      console.log(`     ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}