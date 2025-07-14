import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./utils/web3', () => ({
  fetchStakeEvents: jest.fn().mockResolvedValue([]),
  fetchCreateEvents: jest.fn().mockResolvedValue([]),
}));

test('renders dashboard header', () => {
  render(<App />);
  const headerElement = screen.getByText(/TORUS Analytics Dashboard/i);
  expect(headerElement).toBeInTheDocument();
});

test('renders loading state initially', () => {
  render(<App />);
  const loadingElement = screen.getByText(/Loading blockchain data.../i);
  expect(loadingElement).toBeInTheDocument();
});
