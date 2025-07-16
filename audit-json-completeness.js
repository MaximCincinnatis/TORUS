const fs = require('fs');
const path = require('path');

// Define all required fields based on frontend expectations
const REQUIRED_FIELDS = {
  // Top level fields
  lastUpdated: { type: 'string' },
  version: { type: 'string' },
  
  // Pool data
  poolData: {
    type: 'object',
    fields: {
      sqrtPriceX96: { type: 'string' },
      currentTick: { type: 'number' },
      token0: { type: 'string' },
      token1: { type: 'string' },
      liquidity: { type: 'string' },
      feeGrowthGlobal0X128: { type: 'string' },
      feeGrowthGlobal1X128: { type: 'string' }
    }
  },
  
  // LP Positions
  lpPositions: {
    type: 'array',
    itemFields: {
      tokenId: { type: 'string' },
      owner: { type: 'string' },
      liquidity: { type: 'string' },
      tickLower: { type: 'number' },
      tickUpper: { type: 'number' },
      amount0: { type: 'number' },
      amount1: { type: 'number' },
      inRange: { type: 'boolean' },
      claimableTorus: { type: 'number' },
      claimableTitanX: { type: 'number' },
      estimatedAPR: { type: 'number' },
      priceRange: { type: 'string' }
    }
  },
  
  // Historical data
  historicalData: {
    type: 'object',
    fields: {
      sevenDay: { type: 'array' },
      thirtyDay: { type: 'array' }
    }
  },
  
  // Token prices
  tokenPrices: {
    type: 'object',
    fields: {
      torus: {
        type: 'object',
        fields: {
          usd: { type: 'number' },
          lastUpdated: { type: 'string' }
        }
      },
      titanx: {
        type: 'object',
        fields: {
          usd: { type: 'number' },
          lastUpdated: { type: 'string' }
        }
      }
    }
  },
  
  // CRITICAL: Staking data (missing or incomplete)
  stakingData: {
    type: 'object',
    fields: {
      stakeEvents: {
        type: 'array',
        itemFields: {
          user: { type: 'string' },
          id: { type: 'string' },
          principal: { type: 'string' },
          shares: { type: 'string' },
          duration: { type: 'string' },
          timestamp: { type: 'string' },
          maturityDate: { type: 'string' },
          blockNumber: { type: 'number' },
          stakingDays: { type: 'number' },
          // Additional fields needed by frontend
          power: { type: 'string' },
          claimedCreate: { type: 'boolean' },
          claimedStake: { type: 'boolean' },
          costETH: { type: 'string' },
          costTitanX: { type: 'string' },
          isCreate: { type: 'boolean' }
        }
      },
      createEvents: {
        type: 'array',
        itemFields: {
          user: { type: 'string' },
          id: { type: 'string' },
          torusAmount: { type: 'string' },
          duration: { type: 'string' },
          timestamp: { type: 'string' },
          maturityDate: { type: 'string' },
          blockNumber: { type: 'number' },
          stakingDays: { type: 'number' },
          // Additional fields
          costETH: { type: 'string' },
          costTitanX: { type: 'string' }
        }
      },
      rewardPoolData: {
        type: 'array',
        itemFields: {
          day: { type: 'number' },
          rewardPool: { type: 'number' },
          totalShares: { type: 'number' },
          penaltiesInPool: { type: 'number' }
        }
      },
      currentProtocolDay: { type: 'number' },
      totalSupply: { type: 'number' },
      burnedSupply: { type: 'number' },
      lastUpdated: { type: 'string' }
    }
  },
  
  // Contract data
  contractData: {
    type: 'object',
    fields: {
      torusToken: {
        type: 'object',
        fields: {
          address: { type: 'string' },
          totalSupply: { type: 'string' },
          decimals: { type: 'number' },
          name: { type: 'string' },
          symbol: { type: 'string' }
        }
      },
      titanxToken: {
        type: 'object',
        fields: {
          address: { type: 'string' },
          totalSupply: { type: 'string' },
          decimals: { type: 'number' },
          name: { type: 'string' },
          symbol: { type: 'string' }
        }
      },
      createStakeContract: {
        type: 'object',
        fields: {
          address: { type: 'string' }
        }
      },
      uniswapPool: {
        type: 'object',
        fields: {
          address: { type: 'string' },
          feeTier: { type: 'number' }
        }
      }
    }
  },
  
  // Totals
  totals: {
    type: 'object',
    fields: {
      totalETH: { type: 'string' },
      totalTitanX: { type: 'string' },
      totalStakedETH: { type: 'string' },
      totalCreatedETH: { type: 'string' },
      totalStakedTitanX: { type: 'string' },
      totalCreatedTitanX: { type: 'string' }
    }
  },
  
  // Metadata
  metadata: {
    type: 'object',
    fields: {
      dataSource: { type: 'string' },
      lastCompleteUpdate: { type: 'string' },
      dataComplete: { type: 'boolean' }
    }
  }
};

function auditField(data, fieldName, fieldDef, path = '') {
  const fullPath = path ? `${path}.${fieldName}` : fieldName;
  const issues = [];
  
  if (!(fieldName in data)) {
    issues.push(`❌ MISSING: ${fullPath}`);
    return issues;
  }
  
  const value = data[fieldName];
  
  if (fieldDef.type === 'object' && fieldDef.fields) {
    if (typeof value !== 'object' || value === null) {
      issues.push(`❌ WRONG TYPE: ${fullPath} should be object, got ${typeof value}`);
    } else {
      // Recursively check nested fields
      for (const [nestedField, nestedDef] of Object.entries(fieldDef.fields)) {
        issues.push(...auditField(value, nestedField, nestedDef, fullPath));
      }
    }
  } else if (fieldDef.type === 'array') {
    if (!Array.isArray(value)) {
      issues.push(`❌ WRONG TYPE: ${fullPath} should be array, got ${typeof value}`);
    } else if (fieldDef.itemFields && value.length > 0) {
      // Check first item structure
      const firstItem = value[0];
      for (const [itemField, itemDef] of Object.entries(fieldDef.itemFields)) {
        if (!(itemField in firstItem)) {
          issues.push(`❌ MISSING FIELD: ${fullPath}[0].${itemField}`);
        }
      }
    }
  }
  
  return issues;
}

function auditCachedData() {
  console.log('🔍 AUDITING cached-data.json for completeness...\n');
  
  const dataPath = path.join(__dirname, 'public', 'data', 'cached-data.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('❌ cached-data.json not found!');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const allIssues = [];
  
  // Audit each required field
  for (const [field, def] of Object.entries(REQUIRED_FIELDS)) {
    const issues = auditField(data, field, def);
    allIssues.push(...issues);
  }
  
  // Additional specific checks
  console.log('📊 DATA SUMMARY:');
  console.log(`  - Stake Events: ${data.stakingData?.stakeEvents?.length || 0}`);
  console.log(`  - Create Events: ${data.stakingData?.createEvents?.length || 0}`);
  console.log(`  - LP Positions: ${data.lpPositions?.length || 0}`);
  console.log(`  - Reward Pool Days: ${data.stakingData?.rewardPoolData?.length || 0}`);
  console.log(`  - Current Protocol Day: ${data.stakingData?.currentProtocolDay || 'MISSING'}`);
  console.log(`  - Total Supply: ${data.stakingData?.totalSupply || 'MISSING'}`);
  console.log(`  - Burned Supply: ${data.stakingData?.burnedSupply || 'MISSING'}`);
  
  // Check for ETH/TitanX costs
  const hasETHCosts = data.stakingData?.stakeEvents?.some(e => e.costETH) || false;
  const hasTitanXCosts = data.stakingData?.stakeEvents?.some(e => e.costTitanX) || false;
  
  if (!hasETHCosts) {
    allIssues.push('❌ MISSING: ETH costs in stake events');
  }
  if (!hasTitanXCosts) {
    allIssues.push('❌ MISSING: TitanX costs in stake events');
  }
  
  // Check totals
  if (!data.totals || Object.values(data.totals).every(v => v === '0.000000' || v === '0.00')) {
    allIssues.push('❌ MISSING: Totals are all zeros - ETH/TitanX costs not calculated');
  }
  
  // Report issues
  if (allIssues.length > 0) {
    console.log('\n🚨 ISSUES FOUND:');
    allIssues.forEach(issue => console.log(`  ${issue}`));
    console.log(`\n❌ Total issues: ${allIssues.length}`);
  } else {
    console.log('\n✅ All required fields present!');
  }
  
  // Check which update script was used
  console.log('\n📝 METADATA:');
  console.log(`  - Data Source: ${data.metadata?.dataSource || 'UNKNOWN'}`);
  console.log(`  - Last Updated: ${data.lastUpdated}`);
  console.log(`  - Data Complete: ${data.metadata?.dataComplete || false}`);
  
  return allIssues;
}

// Run audit
const issues = auditCachedData();
process.exit(issues.length > 0 ? 1 : 0);