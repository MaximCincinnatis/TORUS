import React from 'react';
import { render, screen } from '@testing-library/react';
import MetricCard from './MetricCard';

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(
      <MetricCard
        title="Total Staked"
        value="1,234"
        suffix="TORUS"
      />
    );
    
    expect(screen.getByText('Total Staked')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('TORUS')).toBeInTheDocument();
  });
});