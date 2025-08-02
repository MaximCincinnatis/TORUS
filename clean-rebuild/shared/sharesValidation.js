/**
 * Shares Validation Module
 * 
 * Prevents zero-shares bugs by validating data integrity
 * during update processes
 */

/**
 * Validate shares for a position with substantial principal
 * @param {Object} position - Position data
 * @returns {Object} { valid: boolean, warning: string }
 */
function validatePositionShares(position) {
  const principal = position.principal ? parseFloat(position.principal) / 1e18 : 0;
  const shares = position.shares ? parseFloat(position.shares) / 1e18 : 0;
  
  // Positions with substantial principal (>0.01 ETH) should have shares
  if (principal > 0.01 && shares === 0) {
    return {
      valid: false,
      warning: `Position with ${principal.toFixed(4)} ETH principal has zero shares - likely calculation bug`
    };
  }
  
  // Positions with shares should have principal
  if (shares > 0 && principal === 0) {
    return {
      valid: false, 
      warning: `Position with ${shares.toFixed(0)} shares has zero principal - data corruption`
    };
  }
  
  // Check for reasonable shares-to-principal ratio
  if (principal > 0 && shares > 0) {
    const ratio = shares / principal;
    
    // For 88-day positions, ratio should be ~7,744
    // For shorter positions, ratio should be lower
    // Anything below 1 or above 20,000 is suspicious
    if (ratio < 1 || ratio > 20000) {
      return {
        valid: false,
        warning: `Suspicious shares/principal ratio: ${ratio.toFixed(0)} (principal: ${principal.toFixed(4)} ETH, shares: ${shares.toFixed(0)})`
      };
    }
  }
  
  return { valid: true, warning: null };
}

/**
 * Validate all positions in a dataset
 * @param {Array} positions - Array of position objects
 * @param {string} type - 'stakes' or 'creates'
 * @returns {Object} { valid: boolean, warnings: Array, stats: Object }
 */
function validateAllPositions(positions, type = 'positions') {
  const warnings = [];
  let validCount = 0;
  let zeroSharesCount = 0;
  let substantialPrincipalZeroShares = 0;
  
  positions.forEach((position, index) => {
    const validation = validatePositionShares(position);
    
    if (!validation.valid) {
      warnings.push(`${type}[${index}] User ${position.user?.slice(0, 10)}...: ${validation.warning}`);
    } else {
      validCount++;
    }
    
    // Statistics
    const shares = position.shares ? parseFloat(position.shares) / 1e18 : 0;
    const principal = position.principal ? parseFloat(position.principal) / 1e18 : 0;
    
    if (shares === 0) {
      zeroSharesCount++;
      if (principal > 0.01) {
        substantialPrincipalZeroShares++;
      }
    }
  });
  
  return {
    valid: warnings.length === 0,
    warnings,
    stats: {
      total: positions.length,
      valid: validCount,
      zeroShares: zeroSharesCount,
      substantialPrincipalZeroShares,
      warningCount: warnings.length
    }
  };
}

/**
 * Add validation to update scripts
 * Call this after updating stake/create events
 * @param {Object} stakingData - Staking data object with stakeEvents and createEvents
 * @returns {Object} Validation results
 */
function validateStakingData(stakingData) {
  console.log('\n🔍 VALIDATING SHARES DATA...');
  
  const stakeValidation = validateAllPositions(stakingData.stakeEvents || [], 'stakes');
  const createValidation = validateAllPositions(stakingData.createEvents || [], 'creates');
  
  console.log(`   Stakes: ${stakeValidation.stats.valid}/${stakeValidation.stats.total} valid, ${stakeValidation.stats.zeroShares} zero-shares`);
  console.log(`   Creates: ${createValidation.stats.valid}/${createValidation.stats.total} valid, ${createValidation.stats.zeroShares} zero-shares`);
  
  // Report critical issues
  const criticalIssues = stakeValidation.stats.substantialPrincipalZeroShares + createValidation.stats.substantialPrincipalZeroShares;
  
  if (criticalIssues > 0) {
    console.log(`   🚨 CRITICAL: ${criticalIssues} positions with substantial principal but zero shares!`);
    console.log(`   ⚠️  This indicates a shares calculation bug - investigate immediately`);
  }
  
  // Log sample warnings
  const allWarnings = [...stakeValidation.warnings, ...createValidation.warnings];
  if (allWarnings.length > 0) {
    console.log(`   ⚠️  ${allWarnings.length} validation warnings found`);
    if (allWarnings.length <= 5) {
      allWarnings.forEach(warning => console.log(`     - ${warning}`));
    } else {
      allWarnings.slice(0, 3).forEach(warning => console.log(`     - ${warning}`));
      console.log(`     ... and ${allWarnings.length - 3} more warnings`);
    }
  } else {
    console.log(`   ✅ All positions passed validation`);
  }
  
  return {
    stakes: stakeValidation,
    creates: createValidation,
    criticalIssues,
    allValid: stakeValidation.valid && createValidation.valid && criticalIssues === 0
  };
}

/**
 * Emergency shares correction function
 * Use when validation detects zero-shares bugs
 * @param {Object} stakingData - Staking data to fix
 * @param {Function} getContractShares - Function to get shares from contract
 * @returns {Promise<Object>} Fix results
 */
async function emergencySharesCorrection(stakingData, getContractShares) {
  console.log('\n🚨 EMERGENCY SHARES CORRECTION TRIGGERED');
  
  const zeroSharesCreates = stakingData.createEvents.filter(event => {
    const shares = event.shares ? parseFloat(event.shares) / 1e18 : 0;
    const principal = event.principal ? parseFloat(event.principal) / 1e18 : 0;
    return shares === 0 && principal > 0.01; // Only fix substantial positions
  });
  
  if (zeroSharesCreates.length === 0) {
    console.log('   ✅ No zero-shares positions found');
    return { fixed: 0, errors: 0 };
  }
  
  console.log(`   Found ${zeroSharesCreates.length} positions needing correction`);
  
  let fixed = 0;
  let errors = 0;
  
  for (const position of zeroSharesCreates) {
    try {
      const contractShares = await getContractShares(position.user, position.maturityDate);
      if (contractShares && contractShares > 0) {
        position.shares = contractShares.toString();
        fixed++;
        console.log(`   ✅ Fixed shares for ${position.user.slice(0, 10)}...`);
      }
    } catch (error) {
      errors++;
      console.log(`   ❌ Failed to fix ${position.user.slice(0, 10)}...: ${error.message}`);
    }
  }
  
  console.log(`   📊 Correction complete: ${fixed} fixed, ${errors} errors`);
  
  return { fixed, errors };
}

module.exports = {
  validatePositionShares,
  validateAllPositions,
  validateStakingData,
  emergencySharesCorrection
};