import React from 'react';
import './layout/Dashboard.css';

interface TotalsData {
  totalETH?: string;
  totalTitanX?: string;
  totalStakedETH?: string;
  totalCreatedETH?: string;
  totalStakedTitanX?: string;
  totalCreatedTitanX?: string;
}

interface TotalsDisplayProps {
  totals?: TotalsData;
  loading?: boolean;
}

export const TotalsDisplay: React.FC<TotalsDisplayProps> = ({ totals, loading }) => {
  if (loading) {
    return (
      <div className="totals-container">
        <div className="skeleton-loader" style={{ height: '120px', marginBottom: '24px' }} />
      </div>
    );
  }

  if (!totals) {
    return null;
  }

  return (
    <div className="totals-container">
      <div className="totals-grid">
        <div className="total-box total-eth">
          <div className="total-icon">Ξ</div>
          <div className="total-content">
            <div className="total-label">Total ETH Input</div>
            <div className="total-value">{totals.totalETH || '0.00'} ETH</div>
            <div className="total-breakdown">
              <span>Stakes: {totals.totalStakedETH || '0.00'}</span>
              <span className="separator">•</span>
              <span>Creates: {totals.totalCreatedETH || '0.00'}</span>
            </div>
          </div>
        </div>
        
        <div className="total-box total-titanx">
          <div className="total-icon">T</div>
          <div className="total-content">
            <div className="total-label">Total TitanX Input</div>
            <div className="total-value">{totals.totalTitanX || '0.00'} TitanX</div>
            <div className="total-breakdown">
              <span>Stakes: {totals.totalStakedTitanX || '0.00'}</span>
              <span className="separator">•</span>
              <span>Creates: {totals.totalCreatedTitanX || '0.00'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};