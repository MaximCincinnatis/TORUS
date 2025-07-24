/**
 * ETH Transfer Tracking Module
 * Tracks ETH sent to Buy & Process contract for daily breakdown
 * 
 * @module ethTransferTracker
 */

const { ethers } = require('ethers');
const axios = require('axios');

// Method signatures for ETH distribution functions
const METHOD_SIGNATURES = {
  distributeETHForBurning: '0x6ba275bc', // distributeETHForBurning()
  distributeETHForBuilding: '0xd5a47864' // distributeETHForBuilding()
};

/**
 * Fetches ETH transfers from Etherscan API
 * @param {string} contractAddress - Contract address
 * @param {number} fromBlock - Starting block
 * @param {number} toBlock - Ending block
 * @param {string} apiKey - Etherscan API key
 * @returns {Promise<Map<string, number>>} Map of date -> ETH amount
 */
async function fetchETHTransfersFromEtherscan(contractAddress, fromBlock, toBlock, apiKey) {
  const ethTransfersByDay = new Map();
  const url = 'https://api.etherscan.io/api';
  
  try {
    // Fetch normal transactions to the contract
    const txResponse = await axios.get(url, {
      params: {
        module: 'account',
        action: 'txlist',
        address: contractAddress,
        startblock: fromBlock,
        endblock: toBlock,
        sort: 'asc',
        apikey: apiKey
      }
    });
    
    if (txResponse.data.status !== '1') {
      console.warn('  ⚠️ Etherscan API returned no data:', txResponse.data.message);
      return ethTransfersByDay;
    }
    
    // Process transactions
    const transactions = txResponse.data.result || [];
    console.log(`  📝 Found ${transactions.length} transactions`);
    
    for (const tx of transactions) {
      // Only process incoming ETH transfers
      if (tx.to.toLowerCase() === contractAddress.toLowerCase() && tx.value !== '0') {
        // Check if it's a distributeETH function call
        const methodId = tx.input.slice(0, 10);
        if (methodId === METHOD_SIGNATURES.distributeETHForBurning || 
            methodId === METHOD_SIGNATURES.distributeETHForBuilding) {
          
          const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
          const timestamp = parseInt(tx.timeStamp) * 1000;
          const date = new Date(timestamp).toISOString().split('T')[0];
          
          // Add to daily total
          const currentTotal = ethTransfersByDay.get(date) || 0;
          ethTransfersByDay.set(date, currentTotal + ethAmount);
          
          console.log(`  💰 ${date}: +${ethAmount} ETH (${methodId === METHOD_SIGNATURES.distributeETHForBurning ? 'Burning' : 'Building'})`);
        }
      }
    }
    
    console.log(`  ✅ Tracked ETH transfers for ${ethTransfersByDay.size} days`);
    
  } catch (error) {
    console.error('  ❌ Etherscan API error:', error.message);
    // Return empty map on error, don't throw
  }
  
  return ethTransfersByDay;
}

/**
 * Fetches ETH transfers to the Buy & Process contract
 * @param {ethers.Provider} provider - Ethereum provider
 * @param {string} contractAddress - Buy & Process contract address
 * @param {number} fromBlock - Starting block number
 * @param {number} toBlock - Ending block number
 * @returns {Promise<Map<string, number>>} Map of date -> ETH amount
 */
async function fetchETHTransfers(provider, contractAddress, fromBlock, toBlock) {
  console.log(`📊 Fetching ETH transfers from block ${fromBlock} to ${toBlock}...`);
  
  const ethTransfersByDay = new Map();
  
  try {
    // Check if Etherscan API key is available
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (apiKey) {
      console.log('  ✅ Using Etherscan API for ETH transfer tracking');
      return await fetchETHTransfersFromEtherscan(contractAddress, fromBlock, toBlock, apiKey);
    }
    
    // Fallback: Estimate ETH from events ratio
    console.log('  ⚠️ No Etherscan API key found, using estimation method');
    console.log('  ℹ️ Set ETHERSCAN_API_KEY environment variable for accurate tracking');
    
    // For now, return empty map until we implement estimation
    return ethTransfersByDay;
    
  } catch (error) {
    console.error('❌ Error fetching ETH transfers:', error);
    throw error;
  }
}

/**
 * Merges ETH transfer data into daily data
 * @param {Array} dailyData - Existing daily data array
 * @param {Map<string, number>} ethTransfers - ETH transfers by date
 * @returns {Array} Updated daily data with ETH amounts
 */
function mergeETHTransfers(dailyData, ethTransfers) {
  console.log('🔄 Merging ETH transfer data...');
  
  // Create a map for easier updates
  const dailyMap = new Map();
  dailyData.forEach(day => dailyMap.set(day.date, day));
  
  // Add ETH amounts to corresponding days
  ethTransfers.forEach((ethAmount, date) => {
    if (dailyMap.has(date)) {
      const day = dailyMap.get(date);
      day.ethUsed = (day.ethUsed || 0) + ethAmount;
      console.log(`  Updated ${date}: ${ethAmount} ETH`);
    } else {
      // Create new day entry if it doesn't exist
      dailyMap.set(date, {
        date: date,
        buyAndBurnCount: 0,
        buyAndBuildCount: 0,
        fractalCount: 0,
        torusBurned: 0,
        titanXUsed: 0,
        ethUsed: ethAmount,
        torusPurchased: 0,
        fractalTitanX: 0,
        fractalETH: 0
      });
      console.log(`  Created new entry for ${date}: ${ethAmount} ETH`);
    }
  });
  
  // Convert back to sorted array
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Validates that daily ETH sum matches contract totals
 * @param {Array} dailyData - Daily data with ETH amounts
 * @param {string} contractTotalETH - Total ETH from contract
 * @returns {boolean} True if validation passes
 */
function validateETHData(dailyData, contractTotalETH) {
  const dailySum = dailyData.reduce((sum, day) => sum + (day.ethUsed || 0), 0);
  const contractTotal = parseFloat(contractTotalETH);
  const difference = Math.abs(dailySum - contractTotal);
  
  console.log('\n📊 ETH Data Validation:');
  console.log(`  Daily sum: ${dailySum.toFixed(6)} ETH`);
  console.log(`  Contract total: ${contractTotal.toFixed(6)} ETH`);
  console.log(`  Difference: ${difference.toFixed(6)} ETH`);
  
  if (difference > 0.000001) { // Allow small rounding differences
    console.warn(`  ⚠️ WARNING: ETH totals don't match! Difference: ${difference}`);
    return false;
  }
  
  console.log('  ✅ ETH data validation passed!');
  return true;
}

/**
 * Estimates ETH usage based on TitanX amounts and known ratio
 * @param {Array} dailyData - Daily data with titanXUsed amounts
 * @param {number} totalETHUsed - Total ETH used from contract
 * @param {number} totalTitanXUsed - Total TitanX used from contract
 * @returns {Map<string, number>} Map of date -> estimated ETH amount
 */
function estimateETHFromTitanX(dailyData, totalETHUsed, totalTitanXUsed) {
  console.log('\n📊 Estimating ETH usage from TitanX amounts...');
  
  const ethTransfersByDay = new Map();
  
  // Calculate the overall ETH/TitanX ratio
  const ethPerTitanX = totalETHUsed / totalTitanXUsed;
  console.log(`  ETH/TitanX ratio: ${ethPerTitanX.toFixed(10)}`);
  
  // Apply ratio to each day's titanX usage
  let estimatedTotal = 0;
  dailyData.forEach(day => {
    if (day.titanXUsed > 0) {
      const estimatedETH = day.titanXUsed * ethPerTitanX;
      ethTransfersByDay.set(day.date, estimatedETH);
      estimatedTotal += estimatedETH;
      console.log(`  ${day.date}: ${estimatedETH.toFixed(6)} ETH (estimated from ${day.titanXUsed.toFixed(2)} TitanX)`);
    }
  });
  
  // Adjust for rounding errors
  const scaleFactor = totalETHUsed / estimatedTotal;
  console.log(`  Scaling factor: ${scaleFactor.toFixed(6)}`);
  
  // Apply scaling to match total exactly
  ethTransfersByDay.forEach((value, key) => {
    ethTransfersByDay.set(key, value * scaleFactor);
  });
  
  console.log(`  ✅ Estimated ETH for ${ethTransfersByDay.size} days`);
  return ethTransfersByDay;
}

module.exports = {
  fetchETHTransfers,
  mergeETHTransfers,
  validateETHData,
  estimateETHFromTitanX,
  METHOD_SIGNATURES
};