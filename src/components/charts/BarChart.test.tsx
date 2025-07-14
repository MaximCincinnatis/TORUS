import React from 'react';
import { render } from '@testing-library/react';
import BarChart from './BarChart';

describe('BarChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <BarChart
        title="Test Chart"
        labels={['Day 1', 'Day 2', 'Day 3']}
        datasets={[
          {
            label: 'Test Data',
            data: [10, 20, 30],
          },
        ]}
      />
    );
    expect(container).toBeTruthy();
  });
});