import React, { useEffect, useState } from 'react';
import Dashboard from './components/layout/Dashboard';
import MetricCard from './components/metrics/MetricCard';
import BarChart from './components/charts/BarChart';
import LoadingBar from './components/loading/LoadingBar';
import SkeletonCard from './components/loading/SkeletonCard';
import SkeletonChart from './components/loading/SkeletonChart';
import LPPositionsTable from './components/lp/LPPositionsTable';
import { getContractInfo, RewardPoolData } from './utils/ethersWeb3';
import { getTokenInfo, SimpleLPPosition } from './utils/uniswapV3RealOwners';
import { DataCache } from './utils/cache';
import { getMainDashboardDataWithCache, getLPPositionsWithCache } from './utils/cacheDataLoader';
import './App.css';

// Contract launch date - Day 1 (corrected to align with protocol days)
const CONTRACT_START_DATE = new Date('2025-07-11');
CONTRACT_START_DATE.setHours(0, 0, 0, 0);

function App() {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [loadingDetails, setLoadingDetails] = useState<string[]>([]);
  const [stakeData, setStakeData] = useState<any[]>([]);
  const [createData, setCreateData] = useState<any[]>([]);
  const [rewardPoolData, setRewardPoolData] = useState<RewardPoolData[]>([]);
  const [currentProtocolDay, setCurrentProtocolDay] = useState<number>(0);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [burnedSupply, setBurnedSupply] = useState<number>(0);
  const [lpPositions, setLpPositions] = useState<SimpleLPPosition[]>([]);
  const [lpTokenInfo, setLpTokenInfo] = useState<any>(null);
  const [lpLoading, setLpLoading] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLPPositions = async () => {
    setLpLoading(true);
    try {
      console.log('🔍 Starting LP positions fetch with cache...');
      
      // Only use cached LP positions - backend handles updates
      const [lpResult, tokenInfo] = await Promise.all([
        getLPPositionsWithCache(() => Promise.resolve([])),
        getTokenInfo()
      ]);
      
      console.log(`✅ Fetched ${lpResult.positions.length} LP positions from ${lpResult.source}`);
      if (lpResult.positions.length > 0) {
        console.log('First LP position:', lpResult.positions[0]);
      }
      setLpPositions(lpResult.positions);
      setLpTokenInfo(tokenInfo);
      console.log('Token info:', tokenInfo);
    } catch (error) {
      console.error('❌ Error loading LP positions:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
      setLpPositions([]);
    } finally {
      setLpLoading(false);
    }
  };

  const loadData = async (forceFullRefresh: boolean = false) => {
    console.log('🔄 LOADDATA CALLED - Loading from cached JSON only');
    setLoading(true);
    setLoadingProgress(0);
    
    // Always load from cache only - no more RPC calls
    setLoadingMessage('Loading dashboard data...');
    
    try {
      console.log('📡 Starting data fetch...');
      // First, verify contract connectivity
      setLoadingProgress(10);
      setLoadingMessage('Verifying smart contract...');
      const contractInfo = await getContractInfo();
      console.log('Contract info:', contractInfo);
      
      setLoadingProgress(20);
      setLoadingMessage('Fetching stake events from blockchain...');
      setLoadingDetails(['Scanning blockchain for Staked events...']);
      
      // Simulate progress updates during stake fetch
      const stakeProgressInterval = setInterval(() => {
        setLoadingProgress(prev => Math.min(prev + 2, 45));
        setLoadingDetails(prev => [...prev.slice(-3), `Processing stake events... ${Math.floor(Math.random() * 100)}%`]);
      }, 300);
      
      console.log('📊 About to fetch dashboard data with cache...');
      
      // Only use cached data - backend handles all updates
      const dashboardResult = await getMainDashboardDataWithCache(async () => {
        console.log('⚠️ Cache miss - this should not happen with backend updates');
        // Return empty data if cache miss (shouldn't happen)
        return {
          stakeEvents: [],
          createEvents: [],
          rewardPoolData: [],
          currentProtocolDay: 0,
          totalSupply: 0,
          burnedSupply: 0
        };
      });
      
      clearInterval(stakeProgressInterval);
      
      console.log(`✅ Dashboard data loaded from ${dashboardResult.source}:`, {
        stakes: dashboardResult.data.stakeEvents?.length || 0,
        creates: dashboardResult.data.createEvents?.length || 0,
        rewardPool: dashboardResult.data.rewardPoolData?.length || 0
      });
      
      setLoadingDetails(prev => [...prev, `Found ${dashboardResult.data.stakeEvents?.length || 0} stake events from ${dashboardResult.source}`]);
      setLoadingDetails(prev => [...prev, `Found ${dashboardResult.data.createEvents?.length || 0} create events from ${dashboardResult.source}`]);
      
      // Set all the data from cache or RPC
      setStakeData(dashboardResult.data.stakeEvents || []);
      setCreateData(dashboardResult.data.createEvents || []);
      setRewardPoolData(dashboardResult.data.rewardPoolData || []);
      setCurrentProtocolDay(dashboardResult.data.currentProtocolDay || 0);
      setTotalSupply(dashboardResult.data.totalSupply || 0);
      setBurnedSupply(dashboardResult.data.burnedSupply || 0);
      
      setLoadingProgress(55);
      setLoadingDetails(prev => [...prev, `Total supply: ${dashboardResult.data.totalSupply?.toLocaleString() || 0} TORUS`]);
      setLoadingDetails(prev => [...prev, `Current protocol day: ${dashboardResult.data.currentProtocolDay || 0}`]);
      setLoadingDetails(prev => [...prev, `Loaded ${dashboardResult.data.rewardPoolData?.length || 0} days of reward data`]);
      
      setLoadingProgress(85);
      setLoadingMessage('Processing data...');
      setLoadingDetails(prev => [...prev, 'Calculating maturity schedules and projections...']);
      
      console.log(`Fetched ${dashboardResult.data.stakeEvents?.length || 0} stake events and ${dashboardResult.data.createEvents?.length || 0} create events`);
      
      // DEBUG: Log first few events to see their structure
      if (dashboardResult.data.stakeEvents?.length > 0) {
        console.log('Sample stake event:', dashboardResult.data.stakeEvents[0]);
      }
      if (dashboardResult.data.createEvents?.length > 0) {
        console.log('Sample create event:', dashboardResult.data.createEvents[0]);
      }
      
      setLoadingProgress(90);
      setLoadingMessage('Fetching LP positions...');
      setLoadingDetails(prev => [...prev, 'Loading Uniswap V3 liquidity positions...']);
      
      // Load LP positions separately (non-blocking)
      loadLPPositions();
      
      setLoadingProgress(95);
      setLoadingMessage('Calculating projections...');
      
      // Data already set from cache above
      console.log('Data loaded - Stakes:', dashboardResult.data.stakeEvents?.length || 0, 'Creates:', dashboardResult.data.createEvents?.length || 0);
      
      setLoadingProgress(100);
      setLoadingMessage('Complete!');
      
      // Small delay to show completion
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoadingMessage('Error loading data. Please refresh.');
      // No data on error - only show live data
      setStakeData([]);
      setCreateData([]);
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  };


  const calculateStakeReleases = () => {
    const releases: { [key: string]: number } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    console.log('=== STAKE RELEASES DEBUG ===');
    console.log('Total stakes:', stakeData.length);
    console.log('Today:', today.toISOString().split('T')[0]);
    
    // Debug first few stakes to check data structure
    console.log('\nFirst 3 stakes structure:');
    stakeData.slice(0, 3).forEach((stake, i) => {
      console.log(`Stake ${i}:`, {
        maturityDate: stake.maturityDate,
        maturityDateType: typeof stake.maturityDate,
        isDate: stake.maturityDate instanceof Date,
        stakingDays: stake.stakingDays,
        principal: stake.principal
      });
    });
    
    // Initialize next 88 days with 0 count
    for (let i = 0; i < 88; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      releases[dateKey] = 0;
    }
    
    // Count stakes maturing on each day
    let futureStakes = 0;
    const stakeDates = new Map();
    
    stakeData.forEach((stake, idx) => {
      // IMPROVED: Better Date handling for cached data
      let maturityDate: Date;
      try {
        if (stake.maturityDate instanceof Date) {
          maturityDate = stake.maturityDate;
        } else if (typeof stake.maturityDate === 'string') {
          maturityDate = new Date(stake.maturityDate);
        } else {
          console.error(`Invalid maturityDate format for stake ${idx}:`, stake.maturityDate);
          return; // Skip this stake
        }
        
        // Validate the date
        if (isNaN(maturityDate.getTime())) {
          console.error(`Invalid maturityDate for stake ${idx}:`, stake.maturityDate);
          return; // Skip this stake
        }
      } catch (error) {
        console.error(`Error parsing maturityDate for stake ${idx}:`, error);
        return; // Skip this stake
      }
      
      if (maturityDate > today) {
        futureStakes++;
        const dateKey = maturityDate.toISOString().split('T')[0];
        
        // Debug first few stakes
        if (idx < 5) {
          console.log(`Stake ${idx}: maturityDate=${dateKey}, principal=${(parseFloat(stake.principal)/1e18).toFixed(2)} TORUS, duration=${stake.stakingDays} days`);
          console.log(`  -> maturityDate object:`, maturityDate, 'isValid:', !isNaN(maturityDate.getTime()));
        }
        
        if (releases[dateKey] !== undefined) {
          releases[dateKey] += 1; // Count stakes, not amount
          
          // Track unique dates
          if (!stakeDates.has(dateKey)) {
            stakeDates.set(dateKey, 0);
          }
          stakeDates.set(dateKey, stakeDates.get(dateKey) + 1);
        } else {
          console.log(`WARNING: Stake maturity date ${dateKey} is outside 88-day window`);
        }
      } else {
        // Debug past stakes too
        if (idx < 3) {
          console.log(`Stake ${idx} is in past: maturityDate=${maturityDate.toISOString().split('T')[0]}, today=${today.toISOString().split('T')[0]}`);
        }
      }
    });
    
    console.log(`Active stakes (ending in future): ${futureStakes}`);
    console.log(`Unique maturity dates: ${stakeDates.size}`);
    console.log('Dates with stakes:', Array.from(stakeDates.entries()).map(([date, count]) => `${date} (${count} stakes)`).join(', '));
    
    const result = Object.entries(releases).map(([date, count]) => ({
      date,
      count,
    }));
    
    const totalCount = result.reduce((sum, r) => sum + r.count, 0);
    const daysWithStakes = result.filter(r => r.count > 0).length;
    
    console.log(`\nRESULT SUMMARY:`);
    console.log(`Total release entries: ${result.length}`);
    console.log(`Total count in results: ${totalCount}`);
    console.log(`Days with stakes: ${daysWithStakes}`);
    console.log(`First 5 result entries:`, result.slice(0, 5));
    console.log('=== END STAKE DEBUG ===\n');
    
    return result;
  };

  const calculateCreateReleases = () => {
    const releases: { [key: string]: number } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    // Initialize next 88 days with 0 count
    for (let i = 0; i < 88; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      releases[dateKey] = 0;
    }
    
    console.log('=== CREATE RELEASES DATES ===');
    // Count creates maturing on each day
    createData.forEach((create, index) => {
      // Ensure maturityDate is a Date object (cached data might have it as string)
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      if (maturityDate > today) {
        const dateKey = maturityDate.toISOString().split('T')[0];
        if (releases[dateKey] !== undefined) {
          releases[dateKey] += 1; // Count creates ending, not amount
          if (index < 5) { // Log first 5 for debugging
            console.log(`Create ${index}: maturityDate=${dateKey}, endTime=${create.endTime}, timestamp=${create.timestamp}`);
          }
        }
      }
    });
    
    const totalEnding = Object.values(releases).reduce((sum, count) => sum + count, 0);
    console.log(`Total creates ending in next 88 days: ${totalEnding}`);
    console.log('=== END CREATE RELEASES ===\n');
    
    const result = Object.entries(releases).map(([date, count]) => ({
      date,
      count,
    }));
    
    // Debug: Check for non-integer values
    const nonIntegerCounts = result.filter(r => r.count !== Math.floor(r.count));
    if (nonIntegerCounts.length > 0) {
      console.log('🚨 WARNING: Non-integer create counts detected:', nonIntegerCounts);
    }
    
    // Debug: Show first few entries
    console.log('First 5 create release entries:', result.slice(0, 5));
    
    return result;
  };

  // Calculate contract day for a given date
  const getContractDay = (date: Date) => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((date.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
    return daysDiff;
  };

  const calculateTorusReleases = () => {
    const releases: { [key: string]: number } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Initialize next 88 days with 0 amount
    for (let i = 0; i < 88; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      releases[dateKey] = 0;
    }
    
    // Sum TORUS amounts by maturity date
    createData.forEach(create => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      if (maturityDate > today) {
        const dateKey = maturityDate.toISOString().split('T')[0];
        if (releases[dateKey] !== undefined) {
          const amount = parseFloat(create.torusAmount) / 1e18;
          releases[dateKey] += amount;
        }
      }
    });
    
    return Object.entries(releases).map(([date, amount]) => ({
      date,
      amount,
    }));
  };

  const calculateTorusReleasesWithRewards = () => {
    console.log('%c🔍 CALCULATING TORUS RELEASES WITH REWARDS 🔍', 'background: #8b5cf6; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const releases: { [key: string]: { principal: number; rewards: number; total: number } } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Initialize next 88 days
    for (let i = 0; i < 88; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      releases[dateKey] = { principal: 0, rewards: 0, total: 0 };
    }
    
    // First, add principal amounts from creates and stakes maturing
    createData.forEach(create => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      if (maturityDate > today) {
        const dateKey = maturityDate.toISOString().split('T')[0];
        if (releases[dateKey]) {
          const amount = parseFloat(create.torusAmount) / 1e18;
          releases[dateKey].principal += amount;
        }
      }
    });
    
    // Add principal from stakes
    stakeData.forEach(stake => {
      const maturityDate = stake.maturityDate instanceof Date ? stake.maturityDate : new Date(stake.maturityDate);
      if (maturityDate > today) {
        const dateKey = maturityDate.toISOString().split('T')[0];
        if (releases[dateKey]) {
          const amount = parseFloat(stake.principal) / 1e18;
          releases[dateKey].principal += amount;
        }
      }
    });
    
    // Now calculate daily rewards for each active position
    const allPositions = [...createData, ...stakeData];
    console.log(`Calculating rewards for ${allPositions.length} total positions`);
    console.log(`  - Creates: ${createData.length}`);
    console.log(`  - Stakes: ${stakeData.length}`);
    
    // For each day in our range
    for (let i = 0; i < 88; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const protocolDayForDate = currentProtocolDay + i;
      
      // Find reward pool data for this day
      const poolDataForDay = rewardPoolData.find(pd => pd.day === protocolDayForDate);
      
      if (poolDataForDay && parseFloat(poolDataForDay.totalShares) > 0) {
        const rewardPool = parseFloat(poolDataForDay.rewardPool) / 1e18;
        const penaltiesPool = parseFloat(poolDataForDay.penaltiesInPool) / 1e18;
        const totalPoolForDay = rewardPool + penaltiesPool;
        const totalSharesForDay = parseFloat(poolDataForDay.totalShares) / 1e18;
        
        // Debug reward pool data for first few days
        if (i < 3) {
          console.log(`\nDay ${i} reward pool data:`);
          console.log(`  Reward pool: ${rewardPool.toFixed(2)} TORUS`);
          console.log(`  Penalties pool: ${penaltiesPool.toFixed(2)} TORUS`);
          console.log(`  Total pool: ${totalPoolForDay.toFixed(2)} TORUS`);
          console.log(`  Total shares in system: ${totalSharesForDay.toFixed(2)}`);
        }
        
        // Debug first day
        if (i === 0) {
          console.log(`\nDay ${i} (${date.toISOString().split('T')[0]}):`);
          console.log(`  Protocol day: ${protocolDayForDate}`);
          console.log(`  Total pool: ${totalPoolForDay.toFixed(2)} TORUS`);
          console.log(`  Total shares: ${totalSharesForDay.toFixed(2)}`);
        }
        
        // Calculate rewards for each active position on this day
        let activePositionsCount = 0;
        let totalDailyRewardsCalculated = 0;
        
        allPositions.forEach(position => {
          // Check if position is active on this day
          const startDate = new Date(position.timestamp * 1000);
          const endDate = position.maturityDate instanceof Date ? position.maturityDate : new Date(position.maturityDate);
          
          if (date >= startDate && date < endDate) {
            activePositionsCount++;
            // Position is active on this day
            const positionShares = parseFloat(position.shares) / 1e18;
            const dailyReward = (totalPoolForDay * positionShares) / totalSharesForDay;
            totalDailyRewardsCalculated += dailyReward;
            
            // CORRECT: Add daily reward to the MATURITY date (when it's released)
            const maturityKey = endDate.toISOString().split('T')[0];
            if (releases[maturityKey]) {
              releases[maturityKey].rewards += dailyReward;
            }
          }
        });
        
        if (i === 0) {
          console.log(`  Active positions: ${activePositionsCount}`);
          console.log(`  Total daily rewards: ${totalDailyRewardsCalculated.toFixed(2)} TORUS`);
        }
      } else {
        // Debug if no reward pool data
        if (!poolDataForDay && i === 0) {
          console.log(`⚠️ No reward pool data for protocol day ${protocolDayForDate}`);
        } else if (poolDataForDay && parseFloat(poolDataForDay.totalShares) === 0 && i === 0) {
          console.log(`⚠️ Total shares is 0 for protocol day ${protocolDayForDate}`);
        }
      }
    }
    
    // Calculate totals
    Object.keys(releases).forEach(dateKey => {
      releases[dateKey].total = releases[dateKey].principal + releases[dateKey].rewards;
    });
    
    // Calculate summary stats
    const totalPrincipal = Object.values(releases).reduce((sum, r) => sum + r.principal, 0);
    const totalRewards = Object.values(releases).reduce((sum, r) => sum + r.rewards, 0);
    const totalAmount = Object.values(releases).reduce((sum, r) => sum + r.total, 0);
    
    console.log('\nTORUS Release Summary:');
    console.log(`  Total Principal: ${totalPrincipal.toFixed(2)} TORUS`);
    console.log(`  Total Rewards: ${totalRewards.toFixed(2)} TORUS`);
    console.log(`  Total Amount: ${totalAmount.toFixed(2)} TORUS`);
    console.log(`  Reward/Principal Ratio: ${totalPrincipal > 0 ? (totalRewards/totalPrincipal * 100).toFixed(2) : 0}%`);
    
    // Find days with highest rewards
    const sortedByRewards = Object.entries(releases)
      .filter(([_, data]) => data.rewards > 0)
      .sort((a, b) => b[1].rewards - a[1].rewards)
      .slice(0, 5);
    
    console.log('\nTop 5 days by rewards:');
    sortedByRewards.forEach(([date, data], i) => {
      console.log(`  ${i+1}. ${date}: Principal=${data.principal.toFixed(2)}, Rewards=${data.rewards.toFixed(2)}, Total=${data.total.toFixed(2)}`);
    });
    
    console.log('\nSample release data with rewards:', Object.entries(releases).slice(0, 3).map(([date, data]) => ({
      date,
      principal: data.principal.toFixed(2),
      rewards: data.rewards.toFixed(2),
      total: data.total.toFixed(2)
    })));
    
    return Object.entries(releases).map(([date, data]) => ({
      date,
      principal: data.principal,
      rewards: data.rewards,
      total: data.total,
    }));
  };

  const calculateTitanXUsage = () => {
    console.log('%c🔍 CALCULATING TITANX USAGE 🔍', 'background: #f59e0b; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const usage: { [key: string]: number } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`Processing ${createData.length} creates for TitanX...`);
    
    // Initialize next 88 days with 0 amount
    for (let i = 0; i < 88; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      usage[dateKey] = 0;
    }
    
    // Count creates with titanAmount
    const datesWithTitanX: Set<string> = new Set();
    
    // Sum TitanX amounts by maturity date
    createData.forEach((create, index) => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      if (maturityDate > today && create.titanAmount && create.titanAmount !== '0') {
        const dateKey = maturityDate.toISOString().split('T')[0];
        if (usage[dateKey] !== undefined) {
          const amount = parseFloat(create.titanAmount) / 1e18;
          usage[dateKey] += amount;
          datesWithTitanX.add(dateKey);
          
          // Log first 5 creates with TitanX
          if (index < 5 && create.titanAmount !== '0') {
            console.log(`Create ${index}: date=${dateKey}, titanX=${amount.toFixed(2)}`);
          }
        }
      }
    });
    
    console.log(`Total dates with TitanX: ${datesWithTitanX.size}`);
    console.log(`Sample dates with TitanX: ${Array.from(datesWithTitanX).sort().slice(0, 5).join(', ')}`);
    
    return Object.entries(usage).map(([date, amount]) => ({
      date,
      amount,
    }));
  };

  const calculateSharesReleases = () => {
    console.log('%c🔍 CALCULATING SHARES RELEASES 🔍', 'background: #ff0000; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const sharesReleases: { [key: string]: number } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Initialize next 88 days with 0 shares
    for (let i = 0; i < 88; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      sharesReleases[dateKey] = 0;
    }
    
    // Add shares from stakes ending each day
    console.log(`Processing ${stakeData.length} stakes...`);
    stakeData.forEach(stake => {
      const maturityDate = stake.maturityDate instanceof Date ? stake.maturityDate : new Date(stake.maturityDate);
      if (maturityDate > today) {
        const dateKey = maturityDate.toISOString().split('T')[0];
        if (sharesReleases[dateKey] !== undefined) {
          const shares = parseFloat(stake.shares) / 1e18;
          sharesReleases[dateKey] += shares;
        }
      }
    });
    
    // Add shares from creates ending each day
    console.log(`\n=== SHARES FROM CREATES DEBUG ===`);
    console.log(`Processing ${createData.length} creates...`);
    const datesWithShares: Set<string> = new Set();
    
    createData.forEach((create, index) => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      if (maturityDate > today && create.shares) {
        const dateKey = maturityDate.toISOString().split('T')[0];
        if (sharesReleases[dateKey] !== undefined) {
          const shares = parseFloat(create.shares) / 1e18;
          sharesReleases[dateKey] += shares;
          datesWithShares.add(dateKey);
          
          // Log first 5 creates with shares
          if (index < 5) {
            console.log(`Create ${index}: date=${dateKey}, shares=${shares.toFixed(2)}`);
          }
        }
      }
    });
    
    console.log(`Total dates with shares from creates: ${datesWithShares.size}`);
    console.log(`Sample dates with shares: ${Array.from(datesWithShares).sort().slice(0, 5).join(', ')}`);
    
    // Return all dates (including those with 0 shares) to align with other charts
    return Object.entries(sharesReleases)
      .map(([date, shares]) => ({
        date,
        shares,
      }));
  };

  // Only calculate if data is loaded
  const stakeReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateStakeReleases();
  const createReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateCreateReleases();
  const torusReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateTorusReleases();
  const titanXUsage = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateTitanXUsage();
  
  // Move sharesReleases calculation AFTER createReleases
  const sharesReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateSharesReleases();
  
  // Calculate TORUS releases with rewards
  console.log('Checking conditions for torusReleasesWithRewards calculation:', {
    loading,
    stakeDataLength: stakeData.length,
    createDataLength: createData.length,
    rewardPoolDataLength: rewardPoolData.length
  });
  const torusReleasesWithRewards = loading || (stakeData.length === 0 && createData.length === 0) || rewardPoolData.length === 0 ? [] : calculateTorusReleasesWithRewards();
  
  // Debug: Log dates with data for both charts
  if (!loading && createData.length > 0) {
    console.log('\n%c=== DAY 84 vs DAY 88 ANALYSIS ===', 'background: #ff0000; color: white; font-weight: bold; font-size: 16px; padding: 10px');
    
    // Calculate the specific dates for day 84 and 88
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day84Date = new Date(today);
    day84Date.setDate(day84Date.getDate() + 83); // 0-indexed
    const day88Date = new Date(today);
    day88Date.setDate(day88Date.getDate() + 87); // 0-indexed
    
    const day84Key = day84Date.toISOString().split('T')[0];
    const day88Key = day88Date.toISOString().split('T')[0];
    
    console.log(`Day 84 date: ${day84Key}`);
    console.log(`Day 88 date: ${day88Key}`);
    
    // Get data for these specific days
    const day84TitanX = titanXUsage.find(t => t.date === day84Key)?.amount || 0;
    const day88TitanX = titanXUsage.find(t => t.date === day88Key)?.amount || 0;
    
    const day84Torus = torusReleases.find(t => t.date === day84Key)?.amount || 0;
    const day88Torus = torusReleases.find(t => t.date === day88Key)?.amount || 0;
    
    const day84Shares = sharesReleases.find(s => s.date === day84Key)?.shares || 0;
    const day88Shares = sharesReleases.find(s => s.date === day88Key)?.shares || 0;
    
    console.log('\nDay 84 values:');
    console.log(`  - TitanX: ${day84TitanX.toLocaleString()}`);
    console.log(`  - TORUS: ${day84Torus.toLocaleString()}`);
    console.log(`  - Shares: ${day84Shares.toLocaleString()}`);
    
    console.log('\nDay 88 values:');
    console.log(`  - TitanX: ${day88TitanX.toLocaleString()}`);
    console.log(`  - TORUS: ${day88Torus.toLocaleString()}`);
    console.log(`  - Shares: ${day88Shares.toLocaleString()}`);
    
    console.log('\nComparison:');
    console.log(`  - TitanX: Day 88 is ${day88TitanX > day84TitanX ? 'HIGHER' : 'LOWER'} than Day 84`);
    console.log(`  - TORUS: Day 88 is ${day88Torus > day84Torus ? 'HIGHER' : 'LOWER'} than Day 84`);
    console.log(`  - Shares: Day 88 is ${day88Shares > day84Shares ? 'HIGHER' : 'LOWER'} than Day 84`);
    
    // Find all creates ending on these days
    const day84Creates = createData.filter(c => {
      const maturityDate = c.maturityDate instanceof Date ? c.maturityDate : new Date(c.maturityDate);
      return maturityDate.toISOString().split('T')[0] === day84Key;
    });
    const day88Creates = createData.filter(c => {
      const maturityDate = c.maturityDate instanceof Date ? c.maturityDate : new Date(c.maturityDate);
      return maturityDate.toISOString().split('T')[0] === day88Key;
    });
    
    console.log(`\nCreates ending on Day 84: ${day84Creates.length}`);
    day84Creates.forEach((c, i) => {
      if (i < 3) { // Show first 3
        console.log(`  - Create ${i}: amount=${(parseFloat(c.torusAmount)/1e18).toFixed(2)}, days=${c.stakingDays}, shares=${(parseFloat(c.shares)/1e18).toFixed(2)}`);
      }
    });
    
    console.log(`\nCreates ending on Day 88: ${day88Creates.length}`);
    day88Creates.forEach((c, i) => {
      if (i < 3) { // Show first 3
        console.log(`  - Create ${i}: amount=${(parseFloat(c.torusAmount)/1e18).toFixed(2)}, days=${c.stakingDays}, shares=${(parseFloat(c.shares)/1e18).toFixed(2)}`);
      }
    });
    
    // Calculate expected shares vs actual
    console.log('\nShares calculation check:');
    if (day84Creates.length > 0) {
      const c = day84Creates[0];
      const expectedShares = (parseFloat(c.torusAmount) / 1e18) * c.stakingDays * c.stakingDays;
      const actualShares = parseFloat(c.shares) / 1e18;
      console.log(`Day 84 first create: expected=${expectedShares.toFixed(2)}, actual=${actualShares.toFixed(2)}, match=${Math.abs(expectedShares - actualShares) < 0.01}`);
    }
    if (day88Creates.length > 0) {
      const c = day88Creates[0];
      const expectedShares = (parseFloat(c.torusAmount) / 1e18) * c.stakingDays * c.stakingDays;
      const actualShares = parseFloat(c.shares) / 1e18;
      console.log(`Day 88 first create: expected=${expectedShares.toFixed(2)}, actual=${actualShares.toFixed(2)}, match=${Math.abs(expectedShares - actualShares) < 0.01}`);
    }
    
    console.log('=== END DAY ANALYSIS ===\n');
  }
  
  // Stake metrics
  const totalStaked = stakeData.reduce((sum, stake) => sum + parseFloat(stake.principal) / 1e18, 0);
  const activeStakes = stakeData.filter(stake => {
    const maturityDate = stake.maturityDate instanceof Date ? stake.maturityDate : new Date(stake.maturityDate);
    return maturityDate > new Date();
  }).length;
  const avgStakeSize = stakeData.length > 0 ? totalStaked / stakeData.length : 0;
  
  // Debug: Check if stakes are beyond 88 days
  if (!loading && stakeData.length > 0) {
    console.log('\n=== STAKE MATURITY ANALYSIS ===');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day88 = new Date(today);
    day88.setDate(day88.getDate() + 88);
    
    const stakesWithin88Days = stakeData.filter(s => {
      const maturityDate = s.maturityDate instanceof Date ? s.maturityDate : new Date(s.maturityDate);
      return maturityDate > today && maturityDate <= day88;
    }).length;
    const stakesBeyond88Days = stakeData.filter(s => {
      const maturityDate = s.maturityDate instanceof Date ? s.maturityDate : new Date(s.maturityDate);
      return maturityDate > day88;
    }).length;
    
    // Also check the actual calculation
    const endOf88thDay = new Date(today);
    endOf88thDay.setDate(endOf88thDay.getDate() + 88);
    endOf88thDay.setHours(23, 59, 59, 999);
    
    console.log(`Active stakes total: ${activeStakes}`);
    console.log(`Stakes within 88 days: ${stakesWithin88Days}`);
    console.log(`Stakes beyond 88 days: ${stakesBeyond88Days}`);
    
    // Show sample stake dates
    console.log('\nSample stake maturity dates:');
    stakeData.slice(0, 5).forEach((stake, i) => {
      const maturityDate = stake.maturityDate instanceof Date ? stake.maturityDate : new Date(stake.maturityDate);
      const daysFromNow = Math.floor((maturityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  Stake ${i}: maturityDate=${maturityDate.toISOString().split('T')[0]} (${daysFromNow} days from now), stakingDays=${stake.stakingDays}, timestamp=${stake.timestamp}`);
      
      // Calculate what the maturity date SHOULD be
      const stakeTimestamp = parseInt(stake.timestamp);
      const stakingDays = parseInt(stake.stakingDays);
      const expectedMaturityTimestamp = stakeTimestamp + (stakingDays * 86400);
      const expectedMaturityDate = new Date(expectedMaturityTimestamp * 1000);
      
      console.log(`    -> Stake timestamp: ${new Date(stakeTimestamp * 1000).toISOString()}`);
      console.log(`    -> Expected maturity: ${expectedMaturityDate.toISOString().split('T')[0]}`);
      console.log(`    -> Actual maturity: ${maturityDate.toISOString().split('T')[0]}`);
      
      if (expectedMaturityDate.getTime() !== maturityDate.getTime()) {
        console.log(`    ⚠️ MISMATCH! Expected ${expectedMaturityDate.toISOString()} but got ${maturityDate.toISOString()}`);
      }
    });
  }
  
  // Create metrics
  const totalCreated = createData.reduce((sum, create) => sum + parseFloat(create.torusAmount) / 1e18, 0);
  const totalCreates = createData.length;
  const activeCreates = createData.filter(create => {
    const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
    return maturityDate > new Date();
  }).length;
  
  // Calculate average TitanX per create
  const createsWithTitanX = createData.filter(create => create.titanAmount && create.titanAmount !== '0');
  const totalTitanXUsed = createsWithTitanX.reduce((sum, create) => sum + parseFloat(create.titanAmount) / 1e18, 0);
  const avgTitanXPerCreate = createsWithTitanX.length > 0 ? totalTitanXUsed / createsWithTitanX.length : 0;
  
  // Calculate total shares
  const totalShares = [...stakeData, ...createData].reduce((sum, item) => {
    const maturityDate = item.maturityDate instanceof Date ? item.maturityDate : new Date(item.maturityDate);
    if (maturityDate > new Date()) {
      // Shares are raw values (amount * days * days), not divided by 1e18
      // Since amount already has 18 decimals, shares have 18 decimals too
      const sharesValue = parseFloat(item.shares) / 1e18;
      console.log(`Active position - Shares: ${item.shares}, Shares/1e18: ${sharesValue}, Days: ${item.stakingDays}`);
      return sum + sharesValue;
    }
    return sum;
  }, 0);
  
  // Calculate total TORUS locked (staked + created)
  const totalTorusLocked = totalStaked + totalCreated;
  
  // Calculate percentages - just staked, not staked + created
  const percentStaked = totalSupply > 0 ? (totalStaked / totalSupply) * 100 : 0;
  const percentBurned = totalSupply > 0 ? (burnedSupply / totalSupply) * 100 : 0;
  
  // Calculate ETH and TitanX totals for overall metrics
  const stakesWithETH = stakeData.filter(stake => stake.rawCostETH && stake.rawCostETH !== "0");
  const createsWithETH = createData.filter(create => create.rawCostETH && create.rawCostETH !== "0");
  const totalETHFromStakes = stakesWithETH.reduce((sum, stake) => sum + parseFloat(stake.rawCostETH) / 1e18, 0);
  const totalETHFromCreates = createsWithETH.reduce((sum, create) => sum + parseFloat(create.rawCostETH) / 1e18, 0);
  const totalETHInput = totalETHFromStakes + totalETHFromCreates;
  
  const stakesWithTitanX = stakeData.filter(stake => stake.rawCostTitanX && stake.rawCostTitanX !== "0");
  const totalTitanXFromStakes = stakesWithTitanX.reduce((sum, stake) => sum + parseFloat(stake.rawCostTitanX) / 1e18, 0);
  const totalTitanXInput = totalTitanXFromStakes + totalTitanXUsed;
  
  console.log('Supply metrics:', { totalSupply, totalStaked, totalTorusLocked, burnedSupply, percentStaked, percentBurned });
  
  console.log(`Total active shares: ${totalShares}`);
  console.log(`Total creates: ${createData.length}, Active creates: ${activeCreates}`);
  console.log(`Sample create shares calculation: amount * days * days`);
  if (createData.length > 0) {
    const sample = createData[0];
    console.log(`Sample: ${sample.torusAmount} * ${sample.stakingDays} * ${sample.stakingDays} = ${sample.shares}`);
  }

  return (
    <>
      {loading && (
        <LoadingBar progress={loadingProgress} message={loadingMessage} details={loadingDetails} />
      )}
      <Dashboard>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="logo-container">
          <div className="header-left">
            <img src="/torus.svg" alt="TORUS Logo" className="torus-logo" />
            <div className="header-text">
              <h1 className="dashboard-title">
                <span className="torus-text">TORUS</span>
                <span style={{ fontWeight: 700 }}>Dashboard</span>
              </h1>
              <div className="dashboard-subtitle">
                ANALYTICS & INSIGHTS
                <div className="info-icon-container" title="">
                  <svg 
                    className="info-icon"
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <div className="tooltip">
                    <div className="tooltip-content">
                      <strong>Community-Built Dashboard</strong>
                      <p>This dashboard is an independent, community-created tool and is not affiliated with, endorsed by, or maintained by the official TORUS development team or founders. All data is sourced directly from the Ethereum blockchain for transparency and accuracy.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Supply Metrics */}
      <div className="supply-metrics">
        <div className="supply-metrics-grid">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="supply-metric-card">
                <div className="supply-metric-title">Current <span className="torus-text">TORUS</span> Supply</div>
                <div className="supply-metric-value">
                  {totalSupply.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span className="supply-metric-suffix torus-text">TORUS</span>
                </div>
              </div>
              <div className="supply-metric-card">
                <div className="supply-metric-title">% of Current <span className="torus-text">TORUS</span> Supply Staked</div>
                <div className="supply-metric-value">
                  {percentStaked.toFixed(2)}
                  <span className="supply-metric-suffix">%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stake Metrics */}
      <div className="chart-section">
        <h2 className="section-title">Stake Metrics</h2>
        <div className="metrics-grid">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                title={<>Total <span className="torus-text">TORUS</span> Staked</>}
                value={totalStaked.toLocaleString()}
                suffix={<span className="torus-text">TORUS</span>}
              />
              <MetricCard
                title="Active Stakes"
                value={activeStakes.toLocaleString()}
              />
              <MetricCard
                title="Average Stake Size"
                value={avgStakeSize.toFixed(2)}
                suffix={<span className="torus-text">TORUS</span>}
              />
            </>
          )}
        </div>
      </div>

      {/* Create Metrics */}
      <div className="chart-section">
        <h2 className="section-title">Create Metrics</h2>
        <div className="metrics-grid">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                title="Total Creates"
                value={totalCreates.toLocaleString()}
              />
              <MetricCard
                title="Active Creates"
                value={activeCreates.toLocaleString()}
              />
              <MetricCard
                title={<><img src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" alt="TitanX" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', opacity: 0.8 }} />Avg TitanX per Create</>}
                value={avgTitanXPerCreate.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                suffix="TITANX"
              />
            </>
          )}
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="chart-section">
        <h2 className="section-title">Overall Metrics</h2>
        <div className="metrics-grid">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                title={<>Total <span className="torus-text">TORUS</span> Locked</>}
                value={totalTorusLocked.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                suffix={<span className="torus-text">TORUS</span>}
              />
              <MetricCard
                title="Total Active Shares"
                value={totalShares > 1e12 ? 
                  `${(totalShares / 1e12).toLocaleString('en-US', { maximumFractionDigits: 2 })}T` :
                  totalShares > 1e9 ? 
                  `${(totalShares / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B` :
                  totalShares > 1e6 ? 
                  `${(totalShares / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M` :
                  totalShares.toLocaleString('en-US', { maximumFractionDigits: 0 })
                }
                suffix={totalShares > 1e6 ? "" : "SHARES"}
              />
              <MetricCard
                title="Total ETH Input"
                value={totalETHInput.toFixed(2)}
                suffix="ETH"
              />
              <MetricCard
                title={<><img src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" alt="TitanX" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', opacity: 0.8 }} />Total TitanX Used</>}
                value={totalTitanXInput.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                suffix="TITANX"
              />
            </>
          )}
        </div>
      </div>

      <div className="chart-section">
        <h2 className="section-title">Stake Maturity Schedule (Next 88 Days)</h2>
        {loading ? (
          <SkeletonChart />
        ) : (
          <BarChart
            title="Number of Stakes Ending Each Day"
            labels={stakeReleases.slice(0, 88).map(r => {
              const date = new Date(r.date);
              const contractDay = getContractDay(date);
              return [`${r.date.substring(5)}`, `Day ${contractDay}`];
            })}
            datasets={[
              {
                label: 'Number of Stakes',
                data: stakeReleases.slice(0, 88).map(r => r.count),
                backgroundColor: '#4f46e5',
              },
            ]}
            height={600}
            yAxisLabel="Number of Stakes"
            xAxisLabel="Date / Contract Day"
            enableScaleToggle={true}
            integerOnly={true}
          />
        )}
      </div>

      <div className="chart-section">
        <h2 className="section-title">Create Maturity Schedule (Next 88 Days)</h2>
        {loading ? (
          <SkeletonChart />
        ) : (
          <BarChart
            title="Number of Creates Ending Each Day"
            labels={createReleases.slice(0, 88).map(r => {
              const date = new Date(r.date);
              const contractDay = getContractDay(date);
              return [`${r.date.substring(5)}`, `Day ${contractDay}`];
            })}
            datasets={[
              {
                label: 'Number of Creates',
                data: createReleases.slice(0, 88).map(r => r.count),
                backgroundColor: '#10b981',
              },
            ]}
            height={600}
            yAxisLabel="Number of Creates"
            xAxisLabel="Date / Contract Day"
            enableScaleToggle={true}
            integerOnly={true}
            showDataLabels={true}
          />
        )}
      </div>

      <div className="chart-section">
        <h2 className="section-title"><span className="torus-text">TORUS</span> Release Amounts (Next 88 Days)</h2>
        {loading ? (
          <SkeletonChart />
        ) : (
          <BarChart
            title="Total TORUS Amount Releasing Each Day"
            labels={torusReleases.slice(0, 88).map(r => {
              const date = new Date(r.date);
              const contractDay = getContractDay(date);
              return [`${r.date.substring(5)}`, `Day ${contractDay}`];
            })}
            datasets={[
              {
                label: 'TORUS Amount',
                data: torusReleases.slice(0, 88).map(r => Math.round(r.amount * 100) / 100),
                backgroundColor: '#8b5cf6',
              },
            ]}
            height={600}
            yAxisLabel="TORUS Amount"
            xAxisLabel="Date / Contract Day"
            enableScaleToggle={true}
          />
        )}
      </div>

      <div className="chart-section">
        <h2 className="section-title"><span className="torus-text">TORUS</span> Release Schedule with Accrued Rewards</h2>
        {loading ? (
          <SkeletonChart />
        ) : (
          <BarChart
            title="Total TORUS Released Each Day (Principal + Accrued Share Rewards)"
            labels={torusReleasesWithRewards
              .slice(0, 88)
              .map(r => {
                const date = new Date(r.date);
                const contractDay = getContractDay(date);
                return [`${r.date.substring(5)}`, `Day ${contractDay}`];
              })}
            datasets={[
              {
                label: 'Principal TORUS',
                data: torusReleasesWithRewards
                  .slice(0, 88)
                  .map(r => Math.round(r.principal * 100) / 100),
                backgroundColor: '#8b5cf6',
              },
              {
                label: 'Accrued Rewards',
                data: torusReleasesWithRewards
                  .slice(0, 88)
                  .map(r => Math.round(r.rewards * 100) / 100),
                backgroundColor: '#22c55e',
              },
            ]}
            height={600}
            yAxisLabel="TORUS Amount"
            xAxisLabel="Date / Contract Day"
            enableScaleToggle={true}
            stacked={true}
            showLegend={true}
            formatTooltip={(value: number) => `TORUS: ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
            minBarHeight={0}
          />
        )}
        <div className="chart-note">
          Note: Purple bars show principal from stakes/creates ending. Green bars show accrued share rewards that have accumulated daily throughout the position's lifetime. Days with no releases show no bars. Rewards are estimated based on current pool data.
        </div>
      </div>

      <div className="chart-section">
        <h2 className="section-title">
          <img 
            src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" 
            alt="TitanX Logo" 
            style={{ width: '24px', height: '24px', marginRight: '8px', verticalAlign: 'middle', opacity: 0.8 }}
          />
          TitanX Usage by End Date (Next 88 Days)
        </h2>
        {loading ? (
          <SkeletonChart />
        ) : (
          <BarChart
            title="Total TitanX Used for Creates Ending Each Day"
            labels={titanXUsage.slice(0, 88).map(r => {
              const date = new Date(r.date);
              const contractDay = getContractDay(date);
              return [`${r.date.substring(5)}`, `Day ${contractDay}`];
            })}
            datasets={[
              {
                label: 'TitanX Amount',
                data: titanXUsage.slice(0, 88).map(r => Math.round(r.amount * 100) / 100),
                backgroundColor: '#fbbf24',
              },
            ]}
            height={600}
            yAxisLabel="TitanX Amount"
            xAxisLabel="Date / Contract Day"
            formatTooltip={(value: number) => `TitanX: ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
            enableScaleToggle={true}
          />
        )}
      </div>

      <div className="chart-section">
        <h2 className="section-title">Shares Release Schedule (Next 88 Days)</h2>
        {loading ? (
          <SkeletonChart />
        ) : (
          <BarChart
            title="Total Shares Ending Each Day"
            labels={sharesReleases.slice(0, 88).map(r => {
              const date = new Date(r.date);
              const contractDay = getContractDay(date);
              return [`${r.date.substring(5)}`, `Day ${contractDay}`];
            })}
            datasets={[
              {
                label: 'Shares',
                data: sharesReleases.slice(0, 88).map(r => {
                  // Use consistent scaling based on the maximum value
                  const hasB = sharesReleases.some(r => r.shares > 1e9);
                  const hasM = sharesReleases.some(r => r.shares > 1e6);
                  
                  if (hasB) return r.shares / 1e9;
                  if (hasM) return r.shares / 1e6;
                  return r.shares;
                }),
                backgroundColor: '#06b6d4',
              },
            ]}
            height={600}
            yAxisLabel={`Total Shares (${sharesReleases.some(r => r.shares > 1e9) ? 'Billions' : sharesReleases.some(r => r.shares > 1e6) ? 'Millions' : 'Units'})`}
            xAxisLabel="Date / Contract Day"
            formatTooltip={(value: number) => {
              const label = sharesReleases.some(r => r.shares > 1e9) ? 'B' : sharesReleases.some(r => r.shares > 1e6) ? 'M' : '';
              return `Shares: ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${label}`;
            }}
            enableScaleToggle={true}
            minBarHeight={2}
          />
        )}
      </div>

      {/* LP Positions Section */}
      <div className="chart-section">
        <h2 className="section-title">Uniswap V3 Liquidity Providers</h2>
        <LPPositionsTable 
          positions={lpPositions} 
          loading={lpLoading}
          tokenInfo={lpTokenInfo || { token0IsTorus: true, token0IsTitanX: false }}
        />
      </div>

      
      {!loading && stakeData.length === 0 && createData.length === 0 && (
        <div className="error-container">
          <h3>No blockchain data available</h3>
          <p>Unable to fetch live data. Please check your connection or try refreshing.</p>
        </div>
      )}
      
      {/* Community Disclaimer */}
      <div className="community-disclaimer">
        <div className="disclaimer-content">
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ marginRight: '12px', minWidth: '20px' }}
          >
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            <strong>Community-Built Dashboard</strong>
            <p>This dashboard is an independent, community-created tool and is not affiliated with, endorsed by, or maintained by the official TORUS development team or founders. All data is sourced directly from the Ethereum blockchain for transparency and accuracy.</p>
          </div>
        </div>
      </div>

      {/* Data Summary */}
      <div className="data-summary">
        <div className="data-source">
          <h3>Data Source</h3>
          <p>
            {loading ? 'Loading...' : 
             `Live blockchain data (${stakeData.length} stakes, ${createData.length} creates)`}
          </p>
          {!loading && DataCache.getLastBlockNumber() && (
            <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 0' }}>
              Cache: Block {DataCache.getLastBlockNumber()?.toLocaleString()}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>
            Auto-updates every 30 minutes
          </span>
        </div>
      </div>
      
    </Dashboard>
    </>
  );
}

export default App;
