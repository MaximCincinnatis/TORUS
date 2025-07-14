import React from 'react';
import { SimpleLPPosition } from '../../utils/uniswapV3RealOwners';
import { tickToTitanXPrice } from '../../utils/uniswapV3Math';
import './LPPositionsTable.css';

interface LPPositionsTableProps {
  positions: SimpleLPPosition[];
  loading: boolean;
  tokenInfo: {
    token0IsTorus: boolean;
    token0IsTitanX: boolean;
  };
}

const LPPositionsTable: React.FC<LPPositionsTableProps> = ({ positions, loading, tokenInfo }) => {
  if (loading) {
    return (
      <div className="lp-positions-loading">
        <div className="loading-spinner"></div>
        <p>Loading LP positions...</p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="lp-positions-empty">
        <p>No active LP positions found in recent blocks.</p>
        <p className="empty-subtitle">Positions may exist in earlier blocks or through NFT Position Manager.</p>
      </div>
    );
  }

  // Sort positions by total value (approximation based on liquidity)
  const sortedPositions = [...positions].sort((a, b) => {
    const liquidityA = BigInt(a.liquidity);
    const liquidityB = BigInt(b.liquidity);
    return liquidityB > liquidityA ? 1 : -1;
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: number) => {
    if (amount === 0) return '0';
    if (amount < 0.001) return amount.toFixed(6); // Show 6 decimals for very small amounts
    if (amount < 0.1) return amount.toFixed(4);   // Show 4 decimals for small amounts  
    if (amount < 1) return amount.toFixed(3);     // Show 3 decimals for amounts < 1
    if (amount < 1000) return amount.toFixed(2);
    if (amount < 1000000) return `${(amount / 1000).toFixed(2)}K`;
    return `${(amount / 1000000).toFixed(2)}M`;
  };

  const formatClaimableAmount = (amount: number) => {
    if (amount === 0) return '0';
    // Always show at least 3 decimals for claimable amounts to show small fees
    if (amount < 0.001) return amount.toFixed(6);
    if (amount < 1) return amount.toFixed(4);
    if (amount < 1000) return amount.toFixed(3);
    // For large amounts, use locale formatting with commas
    return amount.toLocaleString('en-US', { 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    });
  };

  const formatTitanXAmount = (amount: number) => {
    if (amount === 0) return '0';
    
    // Format the actual number with commas at thousands places
    return amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatTitanXPriceRange = (tickLower: number, tickUpper: number) => {
    // Check if this is a full range position (ticks -887200 to 887200)
    if (tickLower === -887200 && tickUpper === 887200) {
      return "Full Range";
    }
    
    // Convert ticks to TitanX prices (TitanX per 1 TORUS)
    const priceLower = tickToTitanXPrice(tickLower);
    const priceUpper = tickToTitanXPrice(tickUpper);
    
    // Handle edge cases where prices are 0 or invalid
    if (priceLower === 0 && priceUpper === 0) {
      return "Invalid Range";
    }
    
    // Convert to billions and format
    const lowerBillions = priceLower / 1000000000;
    const upperBillions = priceUpper / 1000000000;
    
    // Format with commas, handling very small numbers
    const formatBillions = (value: number) => {
      if (value === 0) return "0.00";
      if (value < 0.01) return value.toFixed(6);
      return value.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    };
    
    const lowerFormatted = formatBillions(lowerBillions);
    const upperFormatted = formatBillions(upperBillions);
    
    return `${lowerFormatted}B - ${upperFormatted}B`;
  };

  return (
    <div className="lp-positions-container">
      <div className="lp-positions-header">
        <h3>Active Liquidity Positions</h3>
        <p className="positions-count">{positions.length} positions found</p>
      </div>
      
      <div className="lp-table-wrapper">
        <table className="lp-positions-table">
          <thead>
            <tr>
              <th>LP Provider</th>
              <th>
                <img src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" 
                     alt="TitanX" className="token-icon" />
                TitanX Amount
              </th>
              <th>
                <span className="torus-text">TORUS</span> Amount
              </th>
              <th>Claimable Yield</th>
              <th>Est. APR (24hr)</th>
              <th>TitanX Price Range (per TORUS)</th>
              <th>Status</th>
              <th>Share %</th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((position, index) => {
              const titanXAmount = tokenInfo.token0IsTitanX ? position.amount0 : position.amount1;
              const torusAmount = tokenInfo.token0IsTorus ? position.amount0 : position.amount1;
              const titanXPriceRange = formatTitanXPriceRange(position.tickLower, position.tickUpper);
              
              // Calculate share percentage (rough estimate)
              const totalLiquidity = positions.reduce((sum, p) => sum + BigInt(p.liquidity), BigInt(0));
              const sharePercent = totalLiquidity > 0 
                ? (Number(BigInt(position.liquidity) * BigInt(10000) / totalLiquidity) / 100)
                : 0;

              return (
                <tr key={`${position.owner}-${index}`}>
                  <td>
                    <a href={`https://etherscan.io/address/${position.owner}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="address-link">
                      {formatAddress(position.owner)}
                    </a>
                  </td>
                  <td>{formatTitanXAmount(titanXAmount)}</td>
                  <td>{formatAmount(torusAmount)}</td>
                  <td className="claimable-yield">
                    <div>{formatClaimableAmount(position.claimableTorus || 0)} TORUS</div>
                    <div>{formatTitanXAmount(position.claimableTitanX || 0)} TitanX</div>
                  </td>
                  <td className="apr">
                    {position.estimatedAPR ? `${position.estimatedAPR.toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="price-range">{titanXPriceRange}</td>
                  <td>
                    <span className={`status-badge ${position.inRange ? 'in-range' : 'out-range'}`}>
                      {position.inRange ? 'In Range' : 'Out of Range'}
                    </span>
                  </td>
                  <td>{sharePercent.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="lp-positions-footer">
        <p className="disclaimer">
          * Data shows individual LP position holders with their actual TORUS and TitanX amounts, claimable yield, and estimated APR (not compounded).
        </p>
      </div>
    </div>
  );
};

export default LPPositionsTable;