// LP Position State Management

const PositionStates = {
  NEW: 'new',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CLOSED: 'closed',
  TRANSFERRED: 'transferred',
  UNKNOWN: 'unknown'
};

const ClosureReasons = {
  ZERO_LIQUIDITY: 'zero_liquidity',
  BURNED: 'burned',
  NO_OWNER: 'no_owner',
  MANUAL_CLOSE: 'manual_close',
  UNKNOWN: 'unknown'
};

/**
 * Determine position status based on various factors
 * @param {Object} position - The position object
 * @param {number} currentBlock - Current block number
 * @param {Object} onChainData - Fresh on-chain data
 * @returns {Object} Status and reason
 */
function determinePositionStatus(position, currentBlock, onChainData = null) {
  // Check if position is burned
  if (onChainData && onChainData.burned) {
    return {
      status: PositionStates.CLOSED,
      reason: ClosureReasons.BURNED,
      timestamp: new Date().toISOString()
    };
  }

  // Check for zero liquidity
  if (position.liquidity === '0' || (onChainData && onChainData.liquidity === '0')) {
    return {
      status: PositionStates.CLOSED,
      reason: ClosureReasons.ZERO_LIQUIDITY,
      timestamp: new Date().toISOString()
    };
  }

  // Check for ownership change
  if (onChainData && onChainData.owner && position.owner !== onChainData.owner) {
    return {
      status: PositionStates.TRANSFERRED,
      previousOwner: position.owner,
      newOwner: onChainData.owner,
      timestamp: new Date().toISOString()
    };
  }

  // Check for inactivity (no activity in 1M blocks ~ 4.5 months)
  const lastActivityBlock = position.lastActivityBlock || position.mintBlock || 0;
  const blocksSinceActivity = currentBlock - lastActivityBlock;
  
  if (blocksSinceActivity > 1000000) {
    return {
      status: PositionStates.INACTIVE,
      blocksSinceActivity,
      timestamp: new Date().toISOString()
    };
  }

  // Position is active
  return {
    status: PositionStates.ACTIVE,
    timestamp: new Date().toISOString()
  };
}

/**
 * Track position state changes
 * @param {Object} oldPosition - Previous position state
 * @param {Object} newPosition - New position state
 * @returns {Object} State transition details
 */
function trackStateTransition(oldPosition, newPosition) {
  const transition = {
    tokenId: oldPosition.tokenId,
    previousStatus: oldPosition.status || PositionStates.UNKNOWN,
    newStatus: newPosition.status,
    timestamp: new Date().toISOString(),
    changes: []
  };

  // Track specific changes
  if (oldPosition.liquidity !== newPosition.liquidity) {
    transition.changes.push({
      field: 'liquidity',
      from: oldPosition.liquidity,
      to: newPosition.liquidity
    });
  }

  if (oldPosition.owner !== newPosition.owner) {
    transition.changes.push({
      field: 'owner',
      from: oldPosition.owner,
      to: newPosition.owner
    });
  }

  return transition;
}

/**
 * Get positions by status
 * @param {Array} positions - Array of positions
 * @param {string} status - Status to filter by
 * @returns {Array} Filtered positions
 */
function getPositionsByStatus(positions, status) {
  return positions.filter(pos => pos.status === status);
}

/**
 * Calculate position statistics
 * @param {Array} positions - Array of positions
 * @returns {Object} Statistics
 */
function calculatePositionStats(positions) {
  const stats = {
    total: positions.length,
    byStatus: {},
    recentlyClosed: 0,
    recentlyCreated: 0
  };

  // Count by status
  Object.values(PositionStates).forEach(status => {
    stats.byStatus[status] = 0;
  });

  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  positions.forEach(pos => {
    // Count by status
    if (pos.status && stats.byStatus[pos.status] !== undefined) {
      stats.byStatus[pos.status]++;
    }

    // Count recently closed (within 7 days)
    if (pos.status === PositionStates.CLOSED && pos.closedAt) {
      const closedTime = new Date(pos.closedAt).getTime();
      if (now - closedTime < 7 * dayInMs) {
        stats.recentlyClosed++;
      }
    }

    // Count recently created (within 7 days)
    if (pos.createdAt) {
      const createdTime = new Date(pos.createdAt).getTime();
      if (now - createdTime < 7 * dayInMs) {
        stats.recentlyCreated++;
      }
    }
  });

  return stats;
}

/**
 * Validate position lifecycle consistency
 * @param {Object} position - Position to validate
 * @returns {Object} Validation result
 */
function validatePositionLifecycle(position) {
  const errors = [];
  const warnings = [];

  // Check for inconsistent states
  if (position.status === PositionStates.ACTIVE && position.liquidity === '0') {
    errors.push('Active position cannot have zero liquidity');
  }

  if (position.status === PositionStates.CLOSED && !position.closedAt) {
    warnings.push('Closed position missing closedAt timestamp');
  }

  if (position.status === PositionStates.TRANSFERRED && !position.previousOwner) {
    warnings.push('Transferred position missing previousOwner');
  }

  // Check timestamps
  if (position.closedAt && position.createdAt) {
    const created = new Date(position.createdAt).getTime();
    const closed = new Date(position.closedAt).getTime();
    if (closed < created) {
      errors.push('Position closed before it was created');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  PositionStates,
  ClosureReasons,
  determinePositionStatus,
  trackStateTransition,
  getPositionsByStatus,
  calculatePositionStats,
  validatePositionLifecycle
};