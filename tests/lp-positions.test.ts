import { render, screen, fireEvent } from '@testing-library/react';
import LPPositionsTable from '../src/components/lp/LPPositionsTable';
import { validateLPPositionData } from './validators/lpPositionValidator';

/**
 * World-Class LP Positions Feature Tests
 * These tests ensure NO FEATURES are broken during updates
 */

describe('LP Positions Table - Feature Protection', () => {
  const mockPositions = [
    {
      tokenId: '813053',
      owner: '0x1234567890123456789012345678901234567890',
      amount0: 1000.123,
      amount1: 5000000.45,
      torusAmount: 1000.123,
      titanxAmount: 5000000.45,
      tickLower: -887200,
      tickUpper: 887200,
      liquidity: '1000000',
      isActive: true,
      inRange: true,
      claimableYield: 125.50,
      estimatedAPR: 45.23
    }
  ];

  describe('Critical Features That Must Never Break', () => {
    
    test('✅ Position ID must be clickable link to Uniswap', () => {
      render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      const link = screen.getByText('813053');
      expect(link).toHaveAttribute('href', 'https://app.uniswap.org/positions/v3/ethereum/813053');
      expect(link).toHaveAttribute('target', '_blank');
    });

    test('✅ TitanX amount must show with logo', () => {
      render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      const titanxLogo = screen.getByAltText('TitanX');
      expect(titanxLogo).toBeInTheDocument();
      expect(titanxLogo).toHaveAttribute('src', expect.stringContaining('TitanXpng'));
    });

    test('✅ TORUS amount must have special styling', () => {
      render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      const torusText = screen.getByText('TORUS Amount');
      const torusSpan = torusText.querySelector('.torus-text');
      expect(torusSpan).toBeInTheDocument();
    });

    test('✅ Status badges must be color-coded', () => {
      render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      const inRangeBadge = screen.getByText('In Range');
      expect(inRangeBadge).toHaveClass('in-range');
      expect(inRangeBadge).toHaveStyle('background-color: rgb(34, 197, 94)'); // green
    });

    test('✅ Amount formatting must follow rules', () => {
      const { rerender } = render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      
      // Test TORUS formatting
      expect(screen.getByText('1,000.123')).toBeInTheDocument(); // >= 1000 with commas
      
      // Test TitanX formatting  
      expect(screen.getByText('5,000,000.45')).toBeInTheDocument(); // with commas
      
      // Test small amounts
      const smallPosition = [{...mockPositions[0], torusAmount: 0.0001, titanxAmount: 0.5}];
      rerender(<LPPositionsTable positions={smallPosition} loading={false} tokenInfo={{}} />);
      expect(screen.getByText('0.000100')).toBeInTheDocument(); // 6 decimals for < 0.001
      expect(screen.getByText('0.50')).toBeInTheDocument(); // 2 decimals for < 1
    });

    test('✅ Full range positions must show "Full Range V3"', () => {
      render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      expect(screen.getByText('Full Range V3')).toBeInTheDocument();
    });

    test('✅ Field mapping amount0/1 → torusAmount/titanxAmount', () => {
      const positionWithoutMapping = [{
        ...mockPositions[0],
        torusAmount: undefined,
        titanxAmount: undefined
      }];
      
      // Component should map automatically
      render(<LPPositionsTable positions={positionWithoutMapping} loading={false} 
        tokenInfo={{token0IsTorus: true, token0IsTitanX: false}} />);
      
      // Should still display amounts using amount0/amount1
      expect(screen.getByText('1,000.123')).toBeInTheDocument();
    });
  });

  describe('Data Validation', () => {
    
    test('❌ Positions with 0 amounts should not display', () => {
      const zeroPosition = [{...mockPositions[0], torusAmount: 0, titanxAmount: 0}];
      render(<LPPositionsTable positions={zeroPosition} loading={false} tokenInfo={{}} />);
      expect(screen.queryByText('813053')).not.toBeInTheDocument();
    });

    test('✅ Required fields must be validated', () => {
      const invalidPosition = {
        tokenId: null, // Missing required field
        owner: '0x123',
        torusAmount: 100,
        titanxAmount: 200
      };
      
      expect(() => validateLPPositionData(invalidPosition)).toThrow('tokenId is required');
    });
  });

  describe('Visual Regression Tests', () => {
    
    test('📸 Table layout matches snapshot', () => {
      const { container } = render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      expect(container).toMatchSnapshot();
    });

    test('📸 Loading state matches snapshot', () => {
      const { container } = render(<LPPositionsTable positions={[]} loading={true} tokenInfo={{}} />);
      expect(container).toMatchSnapshot();
    });
  });

  describe('User Interactions', () => {
    
    test('🖱️ Clicking position ID opens new tab', () => {
      render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={{}} />);
      const link = screen.getByText('813053');
      
      // Verify link behavior
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      fireEvent.click(link);
      // Would open in new tab due to target="_blank"
    });

    test('🖱️ Pagination works correctly', () => {
      const manyPositions = Array(25).fill(null).map((_, i) => ({
        ...mockPositions[0],
        tokenId: `${813053 + i}`,
        owner: `0x${i.toString().padStart(40, '0')}`
      }));
      
      render(<LPPositionsTable positions={manyPositions} loading={false} tokenInfo={{}} />);
      
      // Should show 10 positions (pageSize)
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(11); // 10 data + 1 header
      
      // Should show position count
      expect(screen.getByText('25 positions found')).toBeInTheDocument();
    });
  });
});

/**
 * Integration Tests - Ensure data flows correctly
 */
describe('LP Positions Integration', () => {
  
  test('🔄 Backend data maps to frontend correctly', async () => {
    // Simulate backend response
    const backendData = {
      positions: [{
        tokenId: '813053',
        owner: '0x1234567890123456789012345678901234567890',
        amount0: '1000123000000000000000', // Wei format
        amount1: '5000000450000000000000000',
        tickLower: -887200,
        tickUpper: 887200,
        liquidity: '1000000000000000000'
      }]
    };
    
    // Test data transformation
    const transformed = transformLPData(backendData);
    expect(transformed.positions[0].torusAmount).toBe(1000.123);
    expect(transformed.positions[0].titanxAmount).toBe(5000000.45);
  });
});

/**
 * Performance Tests
 */
describe('LP Positions Performance', () => {
  
  test('⚡ Renders 100 positions in < 100ms', () => {
    const manyPositions = Array(100).fill(null).map((_, i) => ({
      ...mockPositions[0],
      tokenId: `${813053 + i}`
    }));
    
    const start = performance.now();
    render(<LPPositionsTable positions={manyPositions} loading={false} tokenInfo={{}} />);
    const end = performance.now();
    
    expect(end - start).toBeLessThan(100);
  });
});