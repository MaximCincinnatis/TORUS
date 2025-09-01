import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock for @vercel/analytics/react is in src/__mocks__/@vercel/analytics/react.js
jest.mock('@vercel/analytics/react');

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

test('renders TORUS text in the app', () => {
  render(<App />);
  // Check that TORUS text appears (may be multiple instances)
  const torusElements = screen.getAllByText(/TORUS/i);
  expect(torusElements.length).toBeGreaterThan(0);
});

test('renders the app without crashing', () => {
  const { container } = render(<App />);
  expect(container).toBeInTheDocument();
});
