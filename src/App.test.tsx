import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./utils/ethersWeb3', () => ({
  fetchStakeEvents: jest.fn().mockResolvedValue([]),
  fetchCreateEvents: jest.fn().mockResolvedValue([]),
  getContractInfo: jest.fn().mockResolvedValue({}),
  getTorusSupplyData: jest.fn().mockResolvedValue({ totalSupply: 0, burnedSupply: 0 }),
  getCurrentProtocolDay: jest.fn().mockResolvedValue(1),
  fetchRewardPoolData: jest.fn().mockResolvedValue([]),
  getProvider: jest.fn(),
}));

jest.mock('./utils/uniswapV3Events', () => ({
  fetchLPPositionsFromEvents: jest.fn().mockResolvedValue([]),
  getTokenInfo: jest.fn().mockResolvedValue({ token0IsTorus: true, token0IsTitanX: false }),
}));

test('renders dashboard header', () => {
  render(<App />);
  const headerElement = screen.getByText(/Dashboard/i);
  expect(headerElement).toBeInTheDocument();
});

test('renders loading state initially', () => {
  render(<App />);
  const loadingElement = screen.getByText(/Initializing.../i);
  expect(loadingElement).toBeInTheDocument();
});
