/**
 * Comprehensive payment matching for smart-update-fixed.js
 * This function should be integrated into smart-update-fixed.js
 */

const { ethers } = require('ethers');

/**
 * Get comprehensive payment data using multiple matching strategies
 * @param {Array} events - Blockchain events (stakes or creates)
 * @param {Object} provider - Ethers provider
 * @param {Number} minBlock - Minimum block number
 * @param {Number} maxBlock - Maximum block number
 * @returns {Map} Map of event hash -> payment data
 */
async function getComprehensivePaymentData(events, provider, minBlock, maxBlock) {
  if (events.length === 0) return new Map();
  
  const CONTRACTS = {
    TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1'
  };
  
  // Fetch ALL TitanX transfers in the block range
  const titanxABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
  const titanxContract = new ethers.Contract(CONTRACTS.TITANX, titanxABI, provider);
  
  let allTitanXTransfers = [];
  const MAX_RANGE = 2000;
  
  for (let fromBlock = minBlock; fromBlock <= maxBlock; fromBlock += MAX_RANGE) {
    const toBlock = Math.min(fromBlock + MAX_RANGE - 1, maxBlock);
    
    try {
      const filter = titanxContract.filters.Transfer(null, CONTRACTS.TORUS_CREATE_STAKE);
      const transfers = await titanxContract.queryFilter(filter, fromBlock, toBlock);
      allTitanXTransfers.push(...transfers);
    } catch (e) {
      console.log(`  ⚠️ Error fetching TitanX transfers ${fromBlock}-${toBlock}: ${e.message}`);
    }
  }
  
  console.log(`  📊 Found ${allTitanXTransfers.length} TitanX transfers for payment matching`);
  
  // Create payment data map
  const paymentDataMap = new Map();
  let ethPayments = 0;
  let titanXPayments = 0;
  let noPayments = 0;
  
  for (const event of events) {
    const eventKey = `${event.transactionHash}-${event.args.stakeIndex}`;
    
    try {
      // Check for ETH payment first
      const tx = await provider.getTransaction(event.transactionHash);
      
      if (tx && tx.value && ethers.BigNumber.from(tx.value).gt(0)) {
        // ETH payment
        const ethAmountFormatted = ethers.utils.formatEther(tx.value);
        paymentDataMap.set(eventKey, {
          costETH: ethAmountFormatted,
          rawCostETH: tx.value.toString(),
          costTitanX: "0",
          rawCostTitanX: "0",
          ethAmount: tx.value.toString(),
          titanAmount: "0",
          titanXAmount: "0"
        });
        ethPayments++;
      } else {
        // Look for TitanX payment using multiple strategies
        
        // Strategy 1: Exact transaction hash match
        let titanxTransfer = allTitanXTransfers.find(t => 
          t.transactionHash === event.transactionHash
        );
        
        // Strategy 2: Same block + same user
        if (!titanxTransfer) {
          titanxTransfer = allTitanXTransfers.find(t => 
            t.blockNumber === event.blockNumber &&
            t.args.from.toLowerCase() === event.args.user.toLowerCase()
          );
        }
        
        // Strategy 3: Adjacent blocks + same user (±2 blocks)
        if (!titanxTransfer) {
          titanxTransfer = allTitanXTransfers.find(t => 
            Math.abs(t.blockNumber - event.blockNumber) <= 2 &&
            t.args.from.toLowerCase() === event.args.user.toLowerCase()
          );
        }
        
        if (titanxTransfer) {
          const titanxAmount = titanxTransfer.args.value.toString();
          const titanxAmountFormatted = (parseFloat(titanxAmount) / 1e18).toString();
          paymentDataMap.set(eventKey, {
            costTitanX: titanxAmountFormatted,
            rawCostTitanX: titanxAmount,
            costETH: "0",
            rawCostETH: "0",
            titanAmount: titanxAmount,
            titanXAmount: titanxAmount,
            ethAmount: "0"
          });
          titanXPayments++;
          
          // Mark as used to avoid double-counting
          const transferIndex = allTitanXTransfers.indexOf(titanxTransfer);
          if (transferIndex > -1) {
            allTitanXTransfers.splice(transferIndex, 1);
          }
        } else {
          // No payment found - set to zero
          paymentDataMap.set(eventKey, {
            costETH: "0",
            rawCostETH: "0",
            costTitanX: "0",
            rawCostTitanX: "0",
            ethAmount: "0",
            titanAmount: "0",
            titanXAmount: "0"
          });
          noPayments++;
        }
      }
      
    } catch (e) {
      console.log(`  ⚠️ Error getting payment for ${event.args.stakeIndex}: ${e.message}`);
      // Set defaults on error
      paymentDataMap.set(eventKey, {
        costETH: "0",
        rawCostETH: "0",
        costTitanX: "0",
        rawCostTitanX: "0",
        ethAmount: "0",
        titanAmount: "0",
        titanXAmount: "0"
      });
    }
  }
  
  console.log(`  📊 Payment matching results: ETH: ${ethPayments}, TitanX: ${titanXPayments}, No payment: ${noPayments}`);
  
  return paymentDataMap;
}

module.exports = { getComprehensivePaymentData };