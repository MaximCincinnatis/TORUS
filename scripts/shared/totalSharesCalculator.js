/**
 * Shared utility for calculating totalShares for any given protocol day
 * This is the single source of truth for totalShares calculations across all scripts
 */

/**
 * Calculate total shares active on a specific protocol day
 * @param {Array} creates - Array of create events with shares data
 * @param {Array} stakes - Array of stake events with shares data
 * @param {number} protocolDay - The protocol day to calculate for (1-based)
 * @returns {number} Total shares active on that day (in decimal form, not wei)
 */
function calculateTotalSharesForDay(creates, stakes, protocolDay) {
  // Convert protocol day to timestamp
  // Protocol day 1 = July 10, 2025 18:00 UTC
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayTimestamp = CONTRACT_START_DATE.getTime() + ((protocolDay - 1) * msPerDay);
  const dayTimestampSeconds = dayTimestamp / 1000;
  
  let totalShares = 0;
  
  // Count shares from active creates
  creates.forEach(create => {
    if (!create.shares) return;
    
    const startTime = parseInt(create.timestamp);
    const endTime = parseInt(create.endTime);
    
    // Position is active if: startTime <= dayTimestamp < endTime
    if (dayTimestampSeconds >= startTime && dayTimestampSeconds < endTime) {
      // Convert from wei to decimal
      const shares = typeof create.shares === 'string' 
        ? parseFloat(create.shares) / 1e18 
        : create.shares / 1e18;
      totalShares += shares;
    }
  });
  
  // Count shares from active stakes
  stakes.forEach(stake => {
    if (!stake.shares) return;
    
    const startTime = parseInt(stake.timestamp);
    // For stakes, calculate end time from maturityDate
    const endTime = stake.maturityDate 
      ? new Date(stake.maturityDate).getTime() / 1000
      : startTime + (parseInt(stake.stakingDays || 0) * 24 * 60 * 60);
    
    // Position is active if: startTime <= dayTimestamp < endTime
    if (dayTimestampSeconds >= startTime && dayTimestampSeconds < endTime) {
      // Convert from wei to decimal
      const shares = typeof stake.shares === 'string'
        ? parseFloat(stake.shares) / 1e18
        : stake.shares / 1e18;
      totalShares += shares;
    }
  });
  
  return totalShares;
}

/**
 * Calculate total shares for a range of protocol days
 * @param {Array} creates - Array of create events with shares data
 * @param {Array} stakes - Array of stake events with shares data
 * @param {number} startDay - First protocol day to calculate (inclusive)
 * @param {number} endDay - Last protocol day to calculate (inclusive)
 * @returns {Object} Map of protocolDay -> totalShares
 */
function calculateTotalSharesForRange(creates, stakes, startDay, endDay) {
  const result = {};
  
  for (let day = startDay; day <= endDay; day++) {
    result[day] = calculateTotalSharesForDay(creates, stakes, day);
  }
  
  return result;
}

/**
 * Helper to convert protocol day to timestamp
 * @param {number} protocolDay - Protocol day (1-based)
 * @returns {number} Unix timestamp in seconds
 */
function getTimestampForProtocolDay(protocolDay) {
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const msPerDay = 24 * 60 * 60 * 1000;
  return (CONTRACT_START_DATE.getTime() + ((protocolDay - 1) * msPerDay)) / 1000;
}

module.exports = {
  calculateTotalSharesForDay,
  calculateTotalSharesForRange,
  getTimestampForProtocolDay
};