import React from 'react';
import { SimpleLPPosition } from '../../utils/uniswapV3RealOwners';
import { tickToTitanXPrice } from '../../utils/uniswapV3Math';
import { CONTRACTS } from '../../constants/contracts';
import './LPPositionsTable.css';

interface LPPositionsTableProps {
  positions: SimpleLPPosition[];
  loading: boolean;
  tokenInfo: {
    token0IsTorus: boolean;
    token0IsTitanX: boolean;
    token1IsTorus?: boolean;
    token1IsTitanX?: boolean;
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
    // Check if this is a full range position (ticks -887200 to 887200) - updated
    if (tickLower === -887200 && tickUpper === 887200) {
      return "Full Range V3";
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
        <p className="positions-count">{positions.length} positions found</p>
      </div>
      
      <div className="lp-table-wrapper">
        <table className="lp-positions-table">
          <thead>
            <tr>
              <th>Position ID</th>
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
              <th>TitanX Price Range (Millions per TORUS)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((position, index) => {
              // Always use standardized fields
              const titanXAmount = position.titanxAmount || 0;
              const torusAmount = position.torusAmount || 0;
              // Use cached priceRange data, but override for full range positions to show "Full Range V3"
              const isFullRange = position.tickLower === -887200 && position.tickUpper === 887200;
              
              // Format the price range with commas
              const formatPriceRangeWithCommas = (range: string) => {
                if (!range || range === "N/A" || range === "Full Range") return range;
                
                // Split the range and format each number
                const parts = range.split(' - ');
                if (parts.length !== 2) return range;
                
                const formatNumber = (numStr: string) => {
                  const num = parseFloat(numStr);
                  if (isNaN(num)) return numStr;
                  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
                };
                
                return `${formatNumber(parts[0])} - ${formatNumber(parts[1])}`;
              };
              
              const titanXPriceRange = isFullRange 
                ? "Full Range V3" 
                : formatPriceRangeWithCommas((position as any).priceRange) || formatTitanXPriceRange(position.tickLower, position.tickUpper);

              // Check if this position is owned by a TORUS contract
              const isTorusContract = position.owner.toLowerCase() === CONTRACTS.TORUS_BUY_PROCESS.toLowerCase();

              return (
                <tr key={`${position.owner}-${index}`} className={isTorusContract ? 'torus-contract-position' : ''}>
                  <td>
                    {position.tokenId && (
                      <a href={`https://app.uniswap.org/positions/v3/ethereum/${position.tokenId}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="address-link">
                        {position.tokenId}
                      </a>
                    )}
                  </td>
                  <td>
                    <a href={`https://etherscan.io/address/${position.owner}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="address-link">
                      {formatAddress(position.owner)}
                    </a>
                    {isTorusContract && (
                      <span className="torus-contract-badge">TORUS Buy & Process</span>
                    )}
                  </td>
                  <td>{formatTitanXAmount(titanXAmount)}</td>
                  <td>{formatAmount(torusAmount)}</td>
                  <td className="claimable-yield">
                    <div>{formatClaimableAmount(position.claimableTorus || 0)} TORUS</div>
                    <div>{formatTitanXAmount(position.claimableTitanX || 0)} TitanX</div>
                  </td>
                  <td className="price-range">{titanXPriceRange}</td>
                  <td>
                    <span className={`status-badge ${position.inRange ? 'in-range' : 'out-range'}`}>
                      {position.inRange ? 'In Range' : 'Out of Range'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="lp-positions-footer">
        <p className="disclaimer">
          * Data shows individual LP position holders with their actual TORUS and TitanX amounts and current claimable yield.
        </p>
      </div>
    </div>
  );
};

export default LPPositionsTable;