import React from 'react';
import { render, screen } from '@testing-library/react';
import LPPositionsTable from './LPPositionsTable';
import { SimpleLPPosition } from '../../utils/uniswapV3RealOwners';

const mockPositions: SimpleLPPosition[] = [
  {
    tokenId: '123',
    owner: '0x1234567890123456789012345678901234567890',
    liquidity: '1000000000000000000',
    tickLower: -887200,
    tickUpper: 887200,
    torusAmount: 100,
    titanxAmount: 3500000,
    inRange: true,
  },
  {
    tokenId: '456',
    owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    liquidity: '500000000000000000',
    tickLower: 170000,
    tickUpper: 180000,
    torusAmount: 50,
    titanxAmount: 1750000,
    inRange: false,
  },
];

const mockTokenInfo = {
  token0IsTorus: true,
  token0IsTitanX: false,
};

test('renders loading state', () => {
  render(<LPPositionsTable positions={[]} loading={true} tokenInfo={mockTokenInfo} />);
  const loadingElement = screen.getByText(/Loading LP positions.../i);
  expect(loadingElement).toBeInTheDocument();
});

test('renders empty state when no positions', () => {
  render(<LPPositionsTable positions={[]} loading={false} tokenInfo={mockTokenInfo} />);
  const emptyElement = screen.getByText(/No active LP positions found/i);
  expect(emptyElement).toBeInTheDocument();
});

test('renders LP positions table with data', () => {
  render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={mockTokenInfo} />);
  
  // Check header
  expect(screen.getByText(/Active Liquidity Positions/i)).toBeInTheDocument();
  expect(screen.getByText(/2 positions found/i)).toBeInTheDocument();
  
  // Check table headers
  expect(screen.getByText(/LP Provider/i)).toBeInTheDocument();
  expect(screen.getByText(/TitanX Amount/i)).toBeInTheDocument();
  expect(screen.getByText(/TORUS Amount/i)).toBeInTheDocument();
  expect(screen.getByText(/Price Range/i)).toBeInTheDocument();
  expect(screen.getByText(/Status/i)).toBeInTheDocument();
  
  // Check position data
  expect(screen.getByText(/0x1234...7890/i)).toBeInTheDocument();
  expect(screen.getByText(/In Range/i)).toBeInTheDocument();
  expect(screen.getByText(/Out of Range/i)).toBeInTheDocument();
});

test('formats addresses correctly', () => {
  render(<LPPositionsTable positions={mockPositions} loading={false} tokenInfo={mockTokenInfo} />);
  
  // Check that addresses are shortened
  expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
  expect(screen.getByText('0xabcd...abcd')).toBeInTheDocument();
});