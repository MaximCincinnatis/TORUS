import React, { useEffect, useState } from 'react';
import { Analytics } from "@vercel/analytics/react";
import Dashboard from './components/layout/Dashboard';
import MetricCard from './components/metrics/MetricCard';
// import BarChart from './components/charts/BarChart'; // Replaced with PannableBarChart
import LineChart from './components/charts/LineChart';
import PannableLineChart from './components/charts/PannableLineChart';
import PannableBarChart from './components/charts/PannableBarChart';
import ExpandableChartSection from './components/charts/ExpandableChartSection';
import SkeletonCard from './components/loading/SkeletonCard';
import LPPositionsTable from './components/lp/LPPositionsTable';
import FutureMaxSupplyChart from './components/charts/FutureMaxSupplyChart';
import DateRangeButtons from './components/charts/DateRangeButtons';
import { getContractInfo, RewardPoolData } from './utils/ethersWeb3';
import { getTokenInfo, SimpleLPPosition } from './utils/uniswapV3RealOwners';
import { getMainDashboardDataWithCache, getLPPositionsWithCache } from './utils/cacheDataLoader';
import { updateDailySnapshot } from './utils/historicalSupplyTracker';
import './App.css';

// Contract launch date - Day 1 (corrected to align with protocol days)
const CONTRACT_START_DATE = new Date(2025, 6, 10); // July 10, 2025 (month is 0-indexed)
CONTRACT_START_DATE.setHours(0, 0, 0, 0);

// Maximum days to calculate for all charts (for panning capability)
const MAX_CHART_DAYS = 365; // Show up to 1 year of data for panning

// Get current protocol day dynamically
function getCurrentProtocolDay() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((today.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff); // Ensure at least day 1
}

// Helper to determine if chart should be dynamic (forward-looking)
const isForwardLookingChart = (chartId: string) => {
  const forwardLookingCharts = [
    'stake-maturity',
    'create-maturity',
    'torus-releases',
    'torus-rewards',
    'titanx-usage',
    'shares-releases'
  ];
  return forwardLookingCharts.includes(chartId);
};

// Get dynamic date range for forward-looking charts
const getDynamicDateRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 88);
  return { today, endDate };
};

// Build info for debugging Vercel deployments
console.log('Build timestamp:', new Date().toISOString());
console.log('Deployment trigger:', '2025-07-16T18:55:00Z');

function App() {
  const [loading, setLoading] = useState(true);
  
  // Individual loading states for progressive display
  const [totalsLoading, setTotalsLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [projectionLoading, setProjectionLoading] = useState(true);
  
  const [stakeData, setStakeData] = useState<any[]>([]);
  const [createData, setCreateData] = useState<any[]>([]);
  const [rewardPoolData, setRewardPoolData] = useState<RewardPoolData[]>([]);
  const [currentProtocolDay, setCurrentProtocolDay] = useState<number>(0);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [burnedSupply, setBurnedSupply] = useState<number>(0);
  const [lpPositions, setLpPositions] = useState<SimpleLPPosition[]>([]);
  const [lpTokenInfo, setLpTokenInfo] = useState<any>(null);
  const [lpLoading, setLpLoading] = useState(false);
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [cachedTitanXData, setCachedTitanXData] = useState<{totalTitanXBurnt?: string, titanxTotalSupply?: string}>({});
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);
  const [buyProcessData, setBuyProcessData] = useState<any>(null);
  const [lpFeeBurnsData, setLpFeeBurnsData] = useState<any>(null);
  
  // Date range states for charts (default to ALL)
  const [stakeMaturityDays, setStakeMaturityDays] = useState<number>(9999);
  const [torusReleasesDays, setTorusReleasesDays] = useState<number>(9999);
  const [titanXUsageDays, setTitanXUsageDays] = useState<number>(9999);
  const [sharesReleasesDays, setSharesReleasesDays] = useState<number>(9999);
  const [dailyTitanXUsageDays, setDailyTitanXUsageDays] = useState<number>(9999);
  const [futureMaxSupplyDays, setFutureMaxSupplyDays] = useState<number>(30);
  const [torusStakedDays, setTorusStakedDays] = useState<number>(9999);
  const [torusRewardsDays, setTorusRewardsDays] = useState<number>(9999);
  const [supplyProjectionDays, setSupplyProjectionDays] = useState<number>(9999);
  const [torusBurnedDays, setTorusBurnedDays] = useState<number>(9999);
  const [cumulativeTorusBurnedDays, setCumulativeTorusBurnedDays] = useState<number>(9999);
  const [buyBurnActivityDays, setBuyBurnActivityDays] = useState<number>(9999);
  const [titanXEthUsageDays, setTitanXEthUsageDays] = useState<number>(9999);
  const [titanXEthBuildUsageDays, setTitanXEthBuildUsageDays] = useState<number>(9999);
  const [lpFeeBurnsDays, setLpFeeBurnsDays] = useState<number>(9999);
  const [dailyCreatesStakesDays, setDailyCreatesStakesDays] = useState<number>(9999);
  const [preCalculatedProjection, setPreCalculatedProjection] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load TitanX burn data directly from JSON
  useEffect(() => {
    const loadCachedTitanXData = async () => {
      try {
        const response = await fetch(`/data/cached-data.json?t=${Date.now()}`, { cache: 'no-cache' });
        const data = await response.json();
        console.log('🔥 TitanX Data Loaded:', {
          totalTitanXBurnt: data.totalTitanXBurnt,
          titanxTotalSupply: data.titanxTotalSupply,
          parsed: data.totalTitanXBurnt ? (parseFloat(data.totalTitanXBurnt) / 1e18 / 1e9).toFixed(3) + 'B' : '0'
        });
        setCachedTitanXData({
          totalTitanXBurnt: data.totalTitanXBurnt || "0",
          titanxTotalSupply: data.titanxTotalSupply || "0"
        });
        setLastUpdatedTime(data.lastUpdated || null);
      } catch (error) {
        console.error('Error loading TitanX data:', error);
      }
    };
    loadCachedTitanXData();
  }, []);

  // Load Buy & Process data
  useEffect(() => {
    const loadBuyProcessData = async () => {
      try {
        const response = await fetch(`/data/buy-process-data.json?t=${Date.now()}`, { cache: 'no-cache' });
        const data = await response.json();
        console.log('💰 Buy & Process Data Loaded:', {
          totalTorusBurnt: data.totals?.torusBurnt,
          dailyDataCount: data.dailyData?.length
        });
        setBuyProcessData(data);
      } catch (error) {
        console.error('Error loading Buy & Process data:', error);
      }
    };
    loadBuyProcessData();
  }, []);

  // Load LP Fee Burns data
  useEffect(() => {
    const loadLpFeeBurnsData = async () => {
      try {
        const response = await fetch(`/data/buy-process-burns.json?t=${Date.now()}`, { cache: 'no-cache' });
        const data = await response.json();
        console.log('🔥 LP Fee Burns Data Loaded:', {
          totalTorusBurned: data.totals?.torusBurned,
          feeCollections: data.totals?.feeCollections
        });
        setLpFeeBurnsData(data);
      } catch (error) {
        console.error('Error loading LP Fee Burns data:', error);
      }
    };
    loadLpFeeBurnsData();
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
    
    // Always load from cache only - no more RPC calls
    
    try {
      console.log('📡 Starting data fetch...');
      // First, verify contract connectivity
      const contractInfo = await getContractInfo();
      console.log('Contract info:', contractInfo);
      setContractInfo(contractInfo);
      
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
      
      
      console.log(`✅ Dashboard data loaded from ${dashboardResult.source}:`, {
        stakes: dashboardResult.data.stakeEvents?.length || 0,
        creates: dashboardResult.data.createEvents?.length || 0,
        rewardPool: dashboardResult.data.rewardPoolData?.length || 0
      });
      
      
      // Set all the data from cache or RPC
      setStakeData(dashboardResult.data.stakeEvents || []);
      setCreateData(dashboardResult.data.createEvents || []);
      setRewardPoolData(dashboardResult.data.rewardPoolData || []);
      setCurrentProtocolDay(dashboardResult.data.currentProtocolDay || 0);
      setTotalSupply(dashboardResult.data.totalSupply || 0);
      setBurnedSupply(dashboardResult.data.burnedSupply || 0);
      
      // Totals can display as soon as basic data is available
      setTotalsLoading(false);
      
      // Update contract info with cached TitanX burn data
      console.log('🔥 TitanX Burn Data Check:', {
        totalTitanXBurnt: dashboardResult.data.totalTitanXBurnt,
        titanxTotalSupply: dashboardResult.data.titanxTotalSupply
      });
      
      if (dashboardResult.data.totalTitanXBurnt || dashboardResult.data.titanxTotalSupply) {
        setContractInfo((prev: any) => ({
          ...prev,
          totalTitanXBurnt: dashboardResult.data.totalTitanXBurnt || "0",
          titanxTotalSupply: dashboardResult.data.titanxTotalSupply || "0"
        }));
      }
      
      
      // Set pre-calculated projection data if available
      if (dashboardResult.data.chartData?.futureSupplyProjection) {
        setPreCalculatedProjection(dashboardResult.data.chartData.futureSupplyProjection);
        console.log('✅ Loaded pre-calculated projection:', dashboardResult.data.chartData.futureSupplyProjection.length, 'days');
      }
      
      // Charts can display once we have stake/create data
      setChartsLoading(false);
      
      // Projection can display once we have all necessary data
      setProjectionLoading(false);
      
      
      console.log(`Fetched ${dashboardResult.data.stakeEvents?.length || 0} stake events and ${dashboardResult.data.createEvents?.length || 0} create events`);
      
      // DEBUG: Log first few events to see their structure
      if (dashboardResult.data.stakeEvents?.length > 0) {
        console.log('Sample stake event:', dashboardResult.data.stakeEvents[0]);
      }
      if (dashboardResult.data.createEvents?.length > 0) {
        console.log('Sample create event:', dashboardResult.data.createEvents[0]);
      }
      
      
      // Load LP positions separately (non-blocking)
      loadLPPositions();
      
      
      // Update historical supply snapshot if available
      if (dashboardResult.data.metadata?.dailySupplySnapshot) {
        const snapshot = dashboardResult.data.metadata.dailySupplySnapshot;
        updateDailySnapshot(
          snapshot.day,
          snapshot.totalSupply,
          snapshot.burnedSupply
        );
        console.log('Updated daily supply snapshot for day', snapshot.day);
      }
      
      // Data already set from cache above
      console.log('Data loaded - Stakes:', dashboardResult.data.stakeEvents?.length || 0, 'Creates:', dashboardResult.data.createEvents?.length || 0);
      
      
      // Small delay to show completion
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error loading data:', error);
      // No data on error - only show live data
      setStakeData([]);
      setCreateData([]);
      
      // Set all loading states to false on error
      setTotalsLoading(false);
      setChartsLoading(false);
      setProjectionLoading(false);
      
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  };


  const calculateStakeReleases = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    console.log('=== STAKE RELEASES (WITH HISTORY) ===');
    console.log('Total stakes:', stakeData.length);
    console.log('Today:', today.toISOString().split('T')[0]);
    console.log('Contract start:', CONTRACT_START_DATE.toISOString().split('T')[0]);
    
    // Initialize full date range from contract start to future
    const releases = initializeFullDateMap();
    const { daysSinceStart, futureDays, totalDays } = getFullDateRange();
    console.log(`Date range: ${daysSinceStart} days of history + ${futureDays} days future = ${totalDays} total days`);
    
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
      
      const dateKey = maturityDate.toISOString().split('T')[0];
      
      // Debug first few stakes
      if (idx < 5) {
        const isPast = maturityDate <= today;
        console.log(`Stake ${idx}: maturityDate=${dateKey}, principal=${(parseFloat(stake.principal)/1e18).toFixed(2)} TORUS, duration=${stake.stakingDays} days ${isPast ? '(PAST)' : '(FUTURE)'}`);
      }
      
      // Include ALL stakes - both past and future
      if (releases[dateKey] !== undefined) {
        releases[dateKey] += 1; // Count stakes, not amount
        
        // Track unique dates
        if (!stakeDates.has(dateKey)) {
          stakeDates.set(dateKey, 0);
        }
        stakeDates.set(dateKey, stakeDates.get(dateKey) + 1);
        
        if (maturityDate > today) {
          futureStakes++;
        }
      } else {
        console.log(`WARNING: Stake maturity date ${dateKey} is outside date range`);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    console.log('=== CREATE RELEASES (WITH HISTORY) ===');
    console.log('Total creates:', createData.length);
    
    // Initialize full date range from contract start to future
    const releases = initializeFullDateMap();
    const { daysSinceStart, futureDays, totalDays } = getFullDateRange();
    console.log(`Date range: ${daysSinceStart} days of history + ${futureDays} days future = ${totalDays} total days`);
    
    console.log('=== CREATE RELEASES DATES ===');
    // Count creates maturing on each day (both past and future)
    let pastCreates = 0;
    let futureCreates = 0;
    
    createData.forEach((create, index) => {
      // Ensure maturityDate is a Date object (cached data might have it as string)
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      
      // Include both past and future creates
      if (releases[dateKey] !== undefined) {
        releases[dateKey] += 1; // Count creates ending, not amount
        
        if (maturityDate <= today) {
          pastCreates++;
        } else {
          futureCreates++;
        }
        
        if (index < 5) { // Log first 5 for debugging
          console.log(`Create ${index}: maturityDate=${dateKey}, endTime=${create.endTime}, timestamp=${create.timestamp}, isPast=${maturityDate <= today}`);
        }
      }
    });
    
    console.log(`Historical creates (already ended): ${pastCreates}`);
    console.log(`Future creates (still active): ${futureCreates}`);
    
    const totalEnding = Object.values(releases).reduce((sum, count) => sum + count, 0);
    console.log(`Total creates ending in next ${MAX_CHART_DAYS} days: ${totalEnding}`);
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

  // Helper function to parse date strings consistently in local timezone
  const parseDateString = (dateStr: string): Date => {
    // Parse YYYY-MM-DD format in local timezone (not UTC)
    const [year, month, day] = dateStr.split('-').map(num => parseInt(num));
    return new Date(year, month - 1, day); // month is 0-indexed
  };

  // Calculate contract day for a given date
  const getContractDay = (date: Date | string) => {
    const msPerDay = 24 * 60 * 60 * 1000;
    
    // Handle string dates
    const dateObj = typeof date === 'string' ? parseDateString(date) : date;
    
    // Normalize both dates to midnight local time to avoid timezone issues
    const normalizedDate = new Date(dateObj);
    normalizedDate.setHours(0, 0, 0, 0);
    
    const normalizedStart = new Date(CONTRACT_START_DATE);
    normalizedStart.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((normalizedDate.getTime() - normalizedStart.getTime()) / msPerDay) + 1;
    
    // Ensure we never return less than 1 (no Day 0)
    return Math.max(1, daysDiff);
  };

  // Helper function to get full date range from contract start to future
  const getFullDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate total days from contract start to today + 88 days
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceStart = Math.floor((today.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay);
    const futureDays = 88; // Show 88 days into the future
    const totalDays = daysSinceStart + futureDays + 1; // +1 to include today
    
    return {
      startDate: new Date(CONTRACT_START_DATE),
      endDate: new Date(today.getTime() + (futureDays * msPerDay)),
      totalDays,
      daysSinceStart,
      futureDays
    };
  };

  // Helper function to initialize date map with zeros for full range
  const initializeFullDateMap = () => {
    const map: { [key: string]: number } = {};
    const { startDate, totalDays } = getFullDateRange();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate.getTime() + (i * msPerDay));
      const dateKey = date.toISOString().split('T')[0];
      map[dateKey] = 0;
    }
    
    return map;
  };

  const calculateTorusReleases = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('=== TORUS RELEASES (WITH HISTORY) ===');
    console.log('Total creates:', createData.length);
    
    // Initialize full date range from contract start to future
    const releases = initializeFullDateMap();
    const { daysSinceStart, futureDays, totalDays } = getFullDateRange();
    console.log(`Date range: ${daysSinceStart} days of history + ${futureDays} days future = ${totalDays} total days`);
    
    // Sum TORUS amounts by maturity date (both past and future)
    let historicalAmount = 0;
    let futureAmount = 0;
    
    createData.forEach(create => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      
      if (releases[dateKey] !== undefined) {
        const amount = parseFloat(create.torusAmount) / 1e18;
        releases[dateKey] += amount;
        
        if (maturityDate <= today) {
          historicalAmount += amount;
        } else {
          futureAmount += amount;
        }
      }
    });
    
    console.log(`Historical TORUS released (already ended): ${historicalAmount.toFixed(2)}`);
    console.log(`Future TORUS to be released: ${futureAmount.toFixed(2)}`);
    console.log('=== END TORUS RELEASES ===\n');
    
    return Object.entries(releases).map(([date, amount]) => ({
      date,
      amount,
    }));
  };

  const calculateTorusReleasesWithRewards = () => {
    console.log('%c🔍 CALCULATING TORUS RELEASES WITH REWARDS (WITH HISTORY) 🔍', 'background: #8b5cf6; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Initialize full date range from contract start to future
    const releases: { [key: string]: { principal: number; rewards: number; total: number } } = {};
    const { startDate, totalDays, daysSinceStart, futureDays } = getFullDateRange();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    console.log(`Date range: ${daysSinceStart} days of history + ${futureDays} days future = ${totalDays} total days`);
    
    // Initialize all dates with zero values
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate.getTime() + (i * msPerDay));
      const dateKey = date.toISOString().split('T')[0];
      releases[dateKey] = { principal: 0, rewards: 0, total: 0 };
    }
    
    // First, add principal amounts from creates and stakes maturing (both past and future)
    let historicalPrincipal = 0;
    let futurePrincipal = 0;
    
    createData.forEach(create => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      if (releases[dateKey]) {
        const amount = parseFloat(create.torusAmount) / 1e18;
        releases[dateKey].principal += amount;
        
        if (maturityDate <= today) {
          historicalPrincipal += amount;
        } else {
          futurePrincipal += amount;
        }
      }
    });
    
    // Add principal from stakes
    stakeData.forEach(stake => {
      const maturityDate = stake.maturityDate instanceof Date ? stake.maturityDate : new Date(stake.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      if (releases[dateKey]) {
        const amount = parseFloat(stake.principal) / 1e18;
        releases[dateKey].principal += amount;
        
        if (maturityDate <= today) {
          historicalPrincipal += amount;
        } else {
          futurePrincipal += amount;
        }
      }
    });
    
    // Now calculate daily rewards for each active position
    const allPositions = [...createData, ...stakeData];
    console.log(`Calculating rewards for ${allPositions.length} total positions`);
    console.log(`  - Creates: ${createData.length}`);
    console.log(`  - Stakes: ${stakeData.length}`);
    console.log(`Historical principal (already released): ${historicalPrincipal.toFixed(2)} TORUS`);
    console.log(`Future principal (to be released): ${futurePrincipal.toFixed(2)} TORUS`);
    
    // Debug: Check maturity date distribution
    const maturityDistribution: { [key: string]: number } = {};
    allPositions.forEach(position => {
      const maturityDate = position.maturityDate instanceof Date ? position.maturityDate : new Date(position.maturityDate);
      if (maturityDate > today) {
        const dateKey = maturityDate.toISOString().split('T')[0];
        maturityDistribution[dateKey] = (maturityDistribution[dateKey] || 0) + 1;
      }
    });
    
    const futureMaturityDates = Object.keys(maturityDistribution).sort();
    console.log(`Positions mature across ${futureMaturityDates.length} different future dates`);
    console.log(`First maturity: ${futureMaturityDates[0]}`);
    console.log(`Last maturity: ${futureMaturityDates[futureMaturityDates.length - 1]}`);
    
    // Check how many positions mature in September vs October
    const septemberMaturities = futureMaturityDates.filter(d => d.includes('2025-09')).length;
    const octoberMaturities = futureMaturityDates.filter(d => d.includes('2025-10')).length;
    console.log(`September maturity dates: ${septemberMaturities}, October: ${octoberMaturities}`);
    
    // For each day in our full date range (past and future)
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate.getTime() + (i * msPerDay));
      const protocolDayForDate = i + 1; // Protocol days start at 1
      
      // Find reward pool data for this day
      const poolDataForDay = rewardPoolData.find(pd => pd.day === protocolDayForDate);
      
      if (poolDataForDay && parseFloat(poolDataForDay.totalShares) > 0) {
        const rewardPool = parseFloat(poolDataForDay.rewardPool); // Already in decimal form, not wei
        const penaltiesPool = parseFloat(poolDataForDay.penaltiesInPool); // Already in decimal form, not wei
        const totalPoolForDay = rewardPool + penaltiesPool;
        const totalSharesForDay = parseFloat(poolDataForDay.totalShares); // Already in decimal form, not wei
        
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
      .slice(0, 10); // Show top 10 to see the pattern
    
    console.log('\n⚠️ TOP 10 DAYS BY REWARDS (POTENTIAL CHART OVERFLOW ISSUE):');
    sortedByRewards.forEach(([date, data], i) => {
      console.log(`  ${i+1}. ${date}: Principal=${data.principal.toFixed(2)}, Rewards=${data.rewards.toFixed(2)}, Total=${data.total.toFixed(2)}`);
    });
    
    // Check for extremely high values that could break chart
    const highValueDays = Object.entries(releases).filter(([_, data]) => data.total > 50000);
    if (highValueDays.length > 0) {
      console.log('\n🚨 EXTREMELY HIGH VALUE DAYS (>50K TORUS):');
      highValueDays.forEach(([date, data]) => {
        console.log(`  ${date}: Total=${data.total.toFixed(2)} TORUS (P=${data.principal.toFixed(2)}, R=${data.rewards.toFixed(2)})`);
      });
    }
    
    console.log('\nSample release data with rewards:', Object.entries(releases).slice(0, 3).map(([date, data]) => ({
      date,
      principal: data.principal.toFixed(2),
      rewards: data.rewards.toFixed(2),
      total: data.total.toFixed(2)
    })));
    
    // Debug: Check for significant releases after September 12
    const allReleaseDays = Object.entries(releases).map(([date, data]) => ({
      date,
      principal: data.principal,
      rewards: data.rewards,
      total: data.total
    }));
    
    const lateReleases = allReleaseDays.filter(day => {
      const date = new Date(day.date);
      return date >= new Date('2025-09-12') && day.total > 0;
    });
    
    console.log(`\n%c=== RELEASES AFTER SEPT 12 (${lateReleases.length} days with releases) ===`, 'background: #f59e0b; color: white; font-weight: bold; padding: 8px');
    lateReleases.slice(0, 15).forEach(day => {
      console.log(`${day.date}: ${day.total.toFixed(2)} TORUS total (${day.principal.toFixed(2)} principal + ${day.rewards.toFixed(2)} rewards)`);
    });
    
    const totalLateReleases = lateReleases.reduce((sum, day) => sum + day.total, 0);
    console.log(`Total releases from Sept 12 onward: ${totalLateReleases.toFixed(2)} TORUS`);
    console.log('=== END LATE RELEASES DEBUG ===\n');
    
    return allReleaseDays;
  };

  const calculateTitanXUsage = () => {
    console.log('%c🔍 CALCULATING TITANX USAGE (WITH HISTORY) 🔍', 'background: #f59e0b; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`Processing ${createData.length} creates for TitanX...`);
    
    // Initialize full date range from contract start to future
    const usage = initializeFullDateMap();
    const { daysSinceStart, futureDays, totalDays } = getFullDateRange();
    console.log(`Date range: ${daysSinceStart} days of history + ${futureDays} days future = ${totalDays} total days`);
    
    // Count creates with titanAmount
    const datesWithTitanX: Set<string> = new Set();
    let historicalTitanX = 0;
    let futureTitanX = 0;
    
    // Sum TitanX amounts by maturity date (both past and future)
    createData.forEach((create, index) => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      
      if (usage[dateKey] !== undefined && create.titanAmount && create.titanAmount !== '0') {
        const amount = parseFloat(create.titanAmount) / 1e18;
        usage[dateKey] += amount;
        datesWithTitanX.add(dateKey);
        
        if (maturityDate <= today) {
          historicalTitanX += amount;
        } else {
          futureTitanX += amount;
        }
        
        // Log first 5 creates with TitanX
        if (index < 5 && create.titanAmount !== '0') {
          console.log(`Create ${index}: date=${dateKey}, titanX=${amount.toFixed(2)}, isPast=${maturityDate <= today}`);
        }
      }
    });
    
    console.log(`Total dates with TitanX: ${datesWithTitanX.size}`);
    console.log(`Sample dates with TitanX: ${Array.from(datesWithTitanX).sort().slice(0, 5).join(', ')}`);
    console.log(`Historical TitanX used (already ended): ${historicalTitanX.toFixed(2)}`);
    console.log(`Future TitanX to be used: ${futureTitanX.toFixed(2)}`);
    console.log('=== END TITANX USAGE ===\n');
    
    return Object.entries(usage).map(([date, amount]) => ({
      date,
      amount,
    }));
  };

  const calculateDailyTitanXUsage = () => {
    console.log('%c🔍 CALCULATING DAILY TITANX USAGE (CREATES + STAKES) 🔍', 'background: #16a34a; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get the current protocol day to limit the range
    const currentDay = getCurrentProtocolDay();
    const maxDay = currentDay; // Only show up to current day for this chart
    
    // Initialize data structure for each day
    const dailyUsage: { [key: string]: { creates: number; stakes: number } } = {};
    
    // Initialize all days from day 1 to current
    for (let day = 1; day <= maxDay; day++) {
      const date = new Date(CONTRACT_START_DATE);
      date.setDate(date.getDate() + day - 1);
      const dateKey = date.toISOString().split('T')[0];
      dailyUsage[dateKey] = { creates: 0, stakes: 0 };
    }
    
    console.log(`Processing ${createData.length} creates for daily TitanX usage...`);
    
    // Process creates - use the timestamp when TitanX was paid (not maturity)
    createData.forEach((create) => {
      if (create.titanAmount && create.titanAmount !== '0') {
        const createDate = new Date(parseInt(create.timestamp) * 1000);
        createDate.setHours(0, 0, 0, 0);
        const dateKey = createDate.toISOString().split('T')[0];
        
        if (dailyUsage[dateKey]) {
          const amount = parseFloat(create.titanAmount) / 1e18;
          dailyUsage[dateKey].creates += amount;
        }
      }
    });
    
    console.log(`Processing ${stakeData.length} stakes for daily TitanX usage...`);
    
    // Process stakes - use the timestamp when TitanX was paid
    stakeData.forEach((stake) => {
      if (stake.rawCostTitanX && stake.rawCostTitanX !== '0') {
        const stakeDate = new Date(parseInt(stake.timestamp) * 1000);
        stakeDate.setHours(0, 0, 0, 0);
        const dateKey = stakeDate.toISOString().split('T')[0];
        
        if (dailyUsage[dateKey]) {
          const amount = parseFloat(stake.rawCostTitanX) / 1e18;
          dailyUsage[dateKey].stakes += amount;
        }
      }
    });
    
    // Convert to array format
    const result = Object.entries(dailyUsage).map(([date, usage]) => ({
      date,
      creates: usage.creates,
      stakes: usage.stakes,
      total: usage.creates + usage.stakes
    }));
    
    // Log summary
    const totalCreates = result.reduce((sum, day) => sum + day.creates, 0);
    const totalStakes = result.reduce((sum, day) => sum + day.stakes, 0);
    console.log(`Total TitanX from creates: ${totalCreates.toFixed(2)}`);
    console.log(`Total TitanX from stakes: ${totalStakes.toFixed(2)}`);
    console.log(`Total TitanX used: ${(totalCreates + totalStakes).toFixed(2)}`);
    console.log('=== END DAILY TITANX USAGE ===\n');
    
    return result;
  };

  const calculateTorusStakedPerDay = () => {
    console.log('%c🔍 CALCULATING TORUS STAKED PER CONTRACT DAY 🔍', 'background: #8b5cf6; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const stakedPerDay: { [key: number]: number } = {};
    
    console.log(`Processing ${stakeData.length} stakes for daily aggregation...`);
    
    // Get the current protocol day to limit the range
    const currentDay = getCurrentProtocolDay();
    const maxDay = Math.min(currentDay, MAX_CHART_DAYS);
    
    // Initialize only the days from 1 to current protocol day
    for (let day = 1; day <= maxDay; day++) {
      stakedPerDay[day] = 0;
    }
    
    // Aggregate stake principal amounts by contract day
    stakeData.forEach((stake, index) => {
      const stakeDate = new Date(parseInt(stake.timestamp) * 1000);
      const contractDay = getContractDay(stakeDate);
      
      if (contractDay >= 1 && contractDay <= maxDay) {
        const principal = parseFloat(stake.principal) / 1e18;
        stakedPerDay[contractDay] += principal;
        
        // Log first few for debugging
        if (index < 5) {
          console.log(`Stake ${index}: contract day ${contractDay}, principal=${principal.toFixed(2)} TORUS, timestamp=${stake.timestamp}`);
        }
      }
    });
    
    const totalStakedAcrossDays = Object.values(stakedPerDay).reduce((sum, amount) => sum + amount, 0);
    const daysWithStakes = Object.values(stakedPerDay).filter(amount => amount > 0).length;
    
    console.log(`Total TORUS staked: ${totalStakedAcrossDays.toFixed(2)} TORUS`);
    console.log(`Days with stakes: ${daysWithStakes} out of ${maxDay} days`);
    console.log(`Current protocol day: ${currentDay}`);
    
    // Return array format matching other charts
    return Object.entries(stakedPerDay)
      .map(([day, amount]) => ({
        day: parseInt(day),
        amount,
      }))
      .sort((a, b) => a.day - b.day);
  };

  const calculateSharesReleases = () => {
    console.log('%c🔍 CALCULATING SHARES RELEASES (WITH HISTORY) 🔍', 'background: #ff0000; color: white; font-weight: bold; font-size: 20px; padding: 10px');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Initialize full date range from contract start to future
    const sharesReleases = initializeFullDateMap();
    const { daysSinceStart, futureDays, totalDays } = getFullDateRange();
    console.log(`Date range: ${daysSinceStart} days of history + ${futureDays} days future = ${totalDays} total days`);
    
    // Add shares from stakes ending each day (both past and future)
    console.log(`Processing ${stakeData.length} stakes...`);
    let historicalSharesStakes = 0;
    let futureSharesStakes = 0;
    
    stakeData.forEach(stake => {
      const maturityDate = stake.maturityDate instanceof Date ? stake.maturityDate : new Date(stake.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      
      if (sharesReleases[dateKey] !== undefined) {
        const shares = parseFloat(stake.shares) / 1e18;
        sharesReleases[dateKey] += shares;
        
        if (maturityDate <= today) {
          historicalSharesStakes += shares;
        } else {
          futureSharesStakes += shares;
        }
      }
    });
    
    // Add shares from creates ending each day (both past and future)
    console.log(`\n=== SHARES FROM CREATES DEBUG ===`);
    console.log(`Processing ${createData.length} creates...`);
    const datesWithShares: Set<string> = new Set();
    let historicalSharesCreates = 0;
    let futureSharesCreates = 0;
    
    createData.forEach((create, index) => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      
      if (sharesReleases[dateKey] !== undefined && create.shares) {
        const shares = parseFloat(create.shares) / 1e18;
        sharesReleases[dateKey] += shares;
        datesWithShares.add(dateKey);
        
        if (maturityDate <= today) {
          historicalSharesCreates += shares;
        } else {
          futureSharesCreates += shares;
        }
        
        // Log first 5 creates with shares
        if (index < 5) {
          console.log(`Create ${index}: date=${dateKey}, shares=${shares.toFixed(2)}, isPast=${maturityDate <= today}`);
        }
      }
    });
    
    console.log(`Total dates with shares from creates: ${datesWithShares.size}`);
    console.log(`Sample dates with shares: ${Array.from(datesWithShares).sort().slice(0, 5).join(', ')}`);
    console.log(`Historical shares (already released):`)
    console.log(`  - From stakes: ${historicalSharesStakes.toFixed(2)}`);
    console.log(`  - From creates: ${historicalSharesCreates.toFixed(2)}`);
    console.log(`  - Total: ${(historicalSharesStakes + historicalSharesCreates).toFixed(2)}`);
    console.log(`Future shares (to be released):`);
    console.log(`  - From stakes: ${futureSharesStakes.toFixed(2)}`);
    console.log(`  - From creates: ${futureSharesCreates.toFixed(2)}`);
    console.log(`  - Total: ${(futureSharesStakes + futureSharesCreates).toFixed(2)}`);
    console.log('=== END SHARES RELEASES ===\n');
    
    // Return all dates (including those with 0 shares) to align with other charts
    return Object.entries(sharesReleases)
      .map(([date, shares]) => ({
        date,
        shares,
      }));
  };

  // Calculate Buy & Process charts data
  const calculateDailyTorusBurned = (): { date: string; amount: number }[] => {
    if (!buyProcessData?.dailyData) return [];
    
    // LP fee burns are already included in the daily burn data
    // The TorusBuyAndProcess contract executes both regular burns and LP fee burns
    // These show up in the daily totals, so we should NOT add them separately
    
    // Simply return the daily burn data without any additions
    return buyProcessData.dailyData.map((day: any) => ({
      date: day.date,
      amount: day.torusBurned || 0
    }));
  };

  const calculateCumulativeTorusBurned = (): { date: string; amount: number }[] => {
    if (!buyProcessData?.dailyData) return [];
    
    // Get daily burns (LP fee burns are already included in the daily data)
    const dailyBurns = calculateDailyTorusBurned();
    
    // Calculate cumulative burns
    let cumulative = 0;
    return dailyBurns.map((day) => {
      cumulative += day.amount;
      return {
        date: day.date,
        amount: cumulative
      };
    });
  };

  const calculateBuyBurnActivity = (): { date: string; buyAndBurn: number; buyAndBuild: number }[] => {
    if (!buyProcessData?.dailyData) return [];
    
    return buyProcessData.dailyData.map((day: any) => ({
      date: day.date,
      buyAndBurn: day.buyAndBurnCount,
      buyAndBuild: day.buyAndBuildCount
    }));
  };

  const calculateTitanXEthUsage = (): { date: string; titanX: number; eth: number }[] => {
    console.log('🔍 calculateTitanXEthUsage called');
    console.log('buyProcessData available:', !!buyProcessData);
    console.log('buyProcessData.dailyData available:', !!buyProcessData?.dailyData);
    
    if (!buyProcessData?.dailyData) return [];
    
    // Log the first daily data entry to see the structure
    if (buyProcessData.dailyData.length > 0) {
      console.log('First daily data entry structure:', buyProcessData.dailyData[0]);
      // Check a few entries to find one with ETH
      const entriesWithETH = buyProcessData.dailyData.filter((day: any) => day.ethUsedForBurns > 0);
      if (entriesWithETH.length > 0) {
        console.log('Found entries with ETH for burns:', entriesWithETH);
      }
    }
    
    // Use burn-specific data only, matching the chart title
    const data = buyProcessData.dailyData.map((day: any) => ({
      date: day.date,
      titanX: day.titanXUsedForBurns || 0,  // Only burns
      eth: day.ethUsedForBurns || 0         // Only burns
    }));
    
    // If total ETH was used but daily data shows 0, distribute it across days with burns
    const totalEthUsed = parseFloat(buyProcessData.totals.ethUsedForBurns || '0');
    if (totalEthUsed > 0 && data.every((d: { date: string; titanX: number; eth: number }) => d.eth === 0)) {
      console.log('⚠️ ETH total exists but daily data is 0. This might be a data issue.');
      // For now, we'll show the data as is (all zeros)
      // In a real scenario, this should be fixed in the data source
    }
    
    // Debug: Log first few entries to check ETH values
    console.log('%c=== TITANX/ETH USAGE DATA ===', 'background: #f59e0b; color: white; font-weight: bold; font-size: 14px; padding: 8px');
    console.log('TitanX/ETH Usage Data (first 5 entries):', data.slice(0, 5));
    console.log('ETH values:', data.slice(0, 10).map((d: { date: string; titanX: number; eth: number }) => ({ date: d.date, eth: d.eth })));
    
    // Check if any ETH values are non-zero
    const nonZeroEthDays = data.filter((d: { date: string; titanX: number; eth: number }) => d.eth > 0);
    console.log(`Days with ETH usage: ${nonZeroEthDays.length} out of ${data.length} days`);
    if (nonZeroEthDays.length > 0) {
      console.log('First few days with ETH usage:', nonZeroEthDays.slice(0, 5));
    }
    
    // Log totals from buyProcessData
    if (buyProcessData?.totals) {
      console.log('Buy Process Totals:');
      console.log('- Total ETH Used for Burns:', buyProcessData.totals.ethUsedForBurns);
      console.log('- Total TitanX Used for Burns:', buyProcessData.totals.titanXUsedForBurns);
      console.log('- Total TORUS Burnt:', buyProcessData.totals.torusBurnt);
    }
    
    return data;
  };

  // Only calculate if data is loaded
  const stakeReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateStakeReleases();
  const createReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateCreateReleases();
  const torusReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateTorusReleases();
  const titanXUsage = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateTitanXUsage();
  const torusStakedPerDay = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateTorusStakedPerDay();
  
  // Calculate daily creates and stakes count
  const calculateDailyCreatesStakes = (): { day: number; creates: number; stakes: number }[] => {
    const dailyData: { [key: number]: { creates: number; stakes: number } } = {};
    
    // Count creates per day
    createData.forEach(event => {
      const eventDate = new Date(event.startDate);
      const dayNum = Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (!dailyData[dayNum]) {
        dailyData[dayNum] = { creates: 0, stakes: 0 };
      }
      dailyData[dayNum].creates++;
    });
    
    // Count stakes per day
    stakeData.forEach(event => {
      const eventDate = new Date(event.startDate);
      const dayNum = Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (!dailyData[dayNum]) {
        dailyData[dayNum] = { creates: 0, stakes: 0 };
      }
      dailyData[dayNum].stakes++;
    });
    
    // Convert to array and fill gaps
    const result = [];
    // Use actual current day (15) instead of cached value
    const actualCurrentDay = Math.max(currentProtocolDay, 15);
    for (let day = 1; day <= actualCurrentDay; day++) {
      result.push({
        day,
        creates: dailyData[day]?.creates || 0,
        stakes: dailyData[day]?.stakes || 0
      });
    }
    
    return result;
  };
  
  const dailyCreatesStakes = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateDailyCreatesStakes();
  
  // Move sharesReleases calculation AFTER createReleases
  const sharesReleases = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateSharesReleases();
  const dailyTitanXUsage = loading || (stakeData.length === 0 && createData.length === 0) ? [] : calculateDailyTitanXUsage();
  
  // Add function to calculate Build-specific TitanX/ETH usage
  const calculateTitanXEthBuildUsage = (): { date: string; titanX: number; eth: number }[] => {
    if (!buyProcessData?.dailyData) return [];
    
    const data = buyProcessData.dailyData.map((day: any) => ({
      date: day.date,
      titanX: day.titanXUsedForBuilds || 0,  // Only builds
      eth: day.ethUsedForBuilds || 0         // Only builds
    }));
    
    return data;
  };

  // Calculate Buy & Process data
  const dailyTorusBurned = !buyProcessData ? [] : calculateDailyTorusBurned();
  const cumulativeTorusBurned = !buyProcessData ? [] : calculateCumulativeTorusBurned();
  const buyBurnActivity = !buyProcessData ? [] : calculateBuyBurnActivity();
  const titanXEthUsage = !buyProcessData ? [] : calculateTitanXEthUsage();
  const titanXEthBuildUsage = !buyProcessData ? [] : calculateTitanXEthBuildUsage();
  
  // Calculate LP Fee Burns data
  const calculateLPFeeBurns = (): { date: string; torusBurned: number; titanxCollected: number }[] => {
    if (!lpFeeBurnsData?.feeDrivenBurns) return [];
    
    // Create a map to aggregate by date
    const burnsByDate = new Map<string, { torusBurned: number; titanxCollected: number }>();
    
    // Initialize with dates from buy process data for consistent x-axis
    if (buyProcessData?.dailyData) {
      buyProcessData.dailyData.forEach((day: any) => {
        burnsByDate.set(day.date, { torusBurned: 0, titanxCollected: 0 });
      });
    }
    
    // Add LP fee burns
    lpFeeBurnsData.feeDrivenBurns.forEach((burn: any) => {
      const date = burn.date.split('T')[0]; // Extract date part
      const torusBurned = parseFloat(burn.torusBurned);
      const titanxCollected = parseFloat(burn.titanxCollected) / 1e9; // Convert to billions
      
      const existing = burnsByDate.get(date) || { torusBurned: 0, titanxCollected: 0 };
      burnsByDate.set(date, {
        torusBurned: existing.torusBurned + torusBurned,
        titanxCollected: existing.titanxCollected + titanxCollected
      });
    });
    
    // Convert to array and sort by date
    return Array.from(burnsByDate.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };
  
  const lpFeeBurns = !lpFeeBurnsData ? [] : calculateLPFeeBurns();
  
  // Calculate TORUS releases with rewards
  console.log('Checking conditions for torusReleasesWithRewards calculation:', {
    loading,
    stakeDataLength: stakeData.length,
    createDataLength: createData.length,
    rewardPoolDataLength: rewardPoolData.length
  });
  const torusReleasesWithRewards = loading || (stakeData.length === 0 && createData.length === 0) || rewardPoolData.length === 0 ? [] : calculateTorusReleasesWithRewards();
  
  // Calculate future supply projection - SIMPLIFIED to match bar chart data exactly
  const calculateSupplyProjection = () => {
    console.log('\n%c=== SUPPLY PROJECTION DEBUG ===', 'background: #22c55e; color: white; font-weight: bold; font-size: 16px; padding: 10px');
    console.log(`Available torusReleasesWithRewards: ${torusReleasesWithRewards.length} entries`);
    
    // Get current total supply from actual data
    const currentSupply = totalSupply || 19626.60;
    const projection: { date: string; supply: number; released: number; contractDay: number; principal: number; rewards: number }[] = [];
    let cumulativeSupply = currentSupply;
    
    // Use ALL available data - PannableLineChart will handle windowing
    const releaseData = torusReleasesWithRewards; // Use all data for panning
    
    console.log(`Using ${releaseData.length} release data points`);
    console.log(`Starting supply: ${currentSupply.toFixed(2)} TORUS`);
    if (releaseData.length > 0) {
      console.log(`First release: ${releaseData[0].date} - ${releaseData[0].total} TORUS`);
      console.log(`Last release: ${releaseData[releaseData.length - 1].date} - ${releaseData[releaseData.length - 1].total} TORUS`);
    }
    
    releaseData.forEach((release, i) => {
      const dailyRelease = release.total || 0;
      cumulativeSupply += dailyRelease;
      const releaseDate = new Date(release.date);
      const contractDay = getContractDay(releaseDate);
      
      // Debug significant releases and September/October dates
      if (dailyRelease > 100 || release.date.includes('2025-09') || release.date.includes('2025-10') || i >= 85) {
        console.log(`Day ${i+1} (${release.date}, Contract Day ${contractDay}): Principal=${release.principal.toFixed(2)}, Rewards=${release.rewards.toFixed(2)}, Total=${dailyRelease.toFixed(2)}, Cumulative=${cumulativeSupply.toFixed(2)}`);
      }
      
      projection.push({
        date: release.date,
        supply: cumulativeSupply,
        released: dailyRelease,
        contractDay: contractDay,
        principal: release.principal,
        rewards: release.rewards
      });
    });
    
    const maxRelease = Math.max(...projection.map(p => p.released));
    console.log(`Generated ${projection.length} days of projection`);
    console.log(`Final cumulative supply: ${projection[projection.length - 1]?.supply.toLocaleString()}`);
    console.log(`Maximum daily release: ${maxRelease.toLocaleString()}`);
    console.log('=== END SUPPLY PROJECTION DEBUG ===\n');
    
    return projection;
  };
  
  const supplyProjection = loading ? [] : calculateSupplyProjection();
  
  // Debug: Log the actual projection array length and last few entries
  if (!loading && supplyProjection.length > 0) {
    console.log(`\n%c=== SUPPLY PROJECTION VALIDATION ===`, 'background: #ff6b6b; color: white; font-weight: bold; padding: 8px');
    console.log(`Total projection entries: ${supplyProjection.length}`);
    console.log(`Expected: ${MAX_CHART_DAYS} days`);
    if (supplyProjection.length > 85) {
      console.log(`Last 3 entries:`);
      supplyProjection.slice(-3).forEach((entry, i) => {
        console.log(`  ${85 + i + 1}: ${entry.date} - Supply: ${entry.supply.toFixed(2)}`);
      });
    }
    console.log(`First entry: ${supplyProjection[0].date}`);
    console.log(`Last entry: ${supplyProjection[supplyProjection.length - 1].date}`);
    console.log('=== END VALIDATION ===\n');
  }
  
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
    if (maturityDate > new Date() && item.shares) {
      // Shares are raw values (amount * days * days), not divided by 1e18
      // Since amount already has 18 decimals, shares have 18 decimals too
      const sharesValue = parseFloat(item.shares) / 1e18;
      if (!isNaN(sharesValue)) {
        console.log(`Active position - Shares: ${item.shares}, Shares/1e18: ${sharesValue}, Days: ${item.stakingDays}`);
        return sum + sharesValue;
      }
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
  
  // Get actual TitanX burned from cached data (most accurate)
  const totalTitanXBurned = cachedTitanXData.totalTitanXBurnt 
    ? parseFloat(cachedTitanXData.totalTitanXBurnt) / 1e18 
    : 0;
  
  console.log('🔥 TitanX Burn Display Calculation:', {
    cachedData: cachedTitanXData,
    totalTitanXBurned,
    inBillions: (totalTitanXBurned / 1e9).toFixed(3) + 'B'
  });
  
  const titanxTotalSupply = cachedTitanXData.titanxTotalSupply 
    ? parseFloat(cachedTitanXData.titanxTotalSupply) / 1e18 
    : 1000000000000; // 1 trillion fallback
  
  const percentTitanXBurned = titanxTotalSupply > 0 ? (totalTitanXBurned / titanxTotalSupply) * 100 : 0;
  
  console.log('🔥 TitanX Metrics Debug:', {
    contractInfo: contractInfo,
    totalTitanXBurned,
    titanxTotalSupply,
    percentTitanXBurned
  });
  
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
      <Analytics />
      <Dashboard>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="logo-container">
          <div className="header-left">
            <img src="https://www.torus.win/torus.svg" alt="TORUS Logo" className="torus-logo" />
            <div className="header-text">
              <h1 className="dashboard-title">
                <span className="torus-text">TORUS</span>
                <span style={{ fontWeight: 700 }}>Info.fyi</span>
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
              <div style={{ fontSize: '14px', color: '#fbbf24', marginTop: '4px', textAlign: 'center' }}>
                🚧 BETA MODE - Dashboard under active development
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Overall Metrics - MOVED TO TOP */}
      <div className="chart-section">
        <h2 className="section-title">Overall Metrics</h2>
        <div className="metrics-grid">
          {totalsLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              {/* First row */}
              <MetricCard
                title={<><img src="https://www.torus.win/torus.svg" alt="TORUS" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />Current <span className="torus-text">TORUS</span> Supply</>}
                value={totalSupply.toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
                title={<><img src="/eth-logo.svg" alt="Ethereum" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', backgroundColor: 'transparent' }} />Total ETH Input</>}
                value={totalETHInput.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                suffix="ETH"
              />
              {/* Second row - TitanX metrics */}
              <MetricCard
                title={<><img src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" alt="TitanX" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', opacity: 0.8 }} />Total TitanX Burned</>}
                value={totalTitanXBurned > 1e9 ? 
                  `${(totalTitanXBurned / 1e9).toFixed(3)}B` : 
                  totalTitanXBurned.toLocaleString('en-US', { maximumFractionDigits: 0 })
                }
                suffix={totalTitanXBurned > 1e9 ? "" : "TITANX"}
              />
              <MetricCard
                title={<><img src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" alt="TitanX" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', opacity: 0.8 }} />% of TitanX Supply Burned</>}
                value={percentTitanXBurned.toFixed(4)}
                suffix="%"
              />
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
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                title={<><img src="https://www.torus.win/torus.svg" alt="TORUS" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />% of <span className="torus-text">TORUS</span> Supply Staked</>}
                value={percentStaked.toFixed(2)}
                suffix="%"
              />
              <MetricCard
                title={<><img src="https://www.torus.win/torus.svg" alt="TORUS" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />Total <span className="torus-text">TORUS</span> Staked</>}
                value={totalStaked.toLocaleString()}
                suffix={<span className="torus-text">TORUS</span>}
              />
              <MetricCard
                title="Active Stakes"
                value={activeStakes.toLocaleString()}
              />
              <MetricCard
                title={<><img src="https://www.torus.win/torus.svg" alt="TORUS" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />Average Stake Size</>}
                value={avgStakeSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                suffix={<span className="torus-text">TORUS</span>}
              />
              <MetricCard
                title={<><img src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" alt="TitanX" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', opacity: 0.8 }} />Total TitanX Used in Stakes</>}
                value={totalTitanXFromStakes.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                suffix="TITANX"
              />
              <MetricCard
                title={<><img src="/eth-logo.svg" alt="Ethereum" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', backgroundColor: 'transparent' }} />Total ETH Used in Stakes</>}
                value={totalETHFromStakes.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                suffix="ETH"
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
              <MetricCard
                title={<><img src="https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654" alt="TitanX" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', opacity: 0.8 }} />Total TitanX Used in Creates</>}
                value={totalTitanXUsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                suffix="TITANX"
              />
              <MetricCard
                title={<><img src="/eth-logo.svg" alt="Ethereum" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle', backgroundColor: 'transparent' }} />Total ETH Used in Creates</>}
                value={totalETHFromCreates.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                suffix="ETH"
              />
            </>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <ExpandableChartSection
        id="max-supply-projection"
        title="Maximum Possible Supply If All Positions Maintain Their Share Percentages"
        subtitle="Future TORUS Max Supply Projection"
        chartType="line"
        keyMetrics={[
          {
            label: "Active Positions",
            value: [...stakeData, ...createData].length.toString(),
            trend: "neutral"
          },
          {
            label: "Total Shares",
            value: rewardPoolData.length > 0 ? Math.round(parseFloat(rewardPoolData[rewardPoolData.length - 1]?.totalShares || "0")).toLocaleString() : "0",
            trend: "up"
          },
          {
            label: "Daily Reward Pool",
            value: rewardPoolData.length > 0 ? Math.round(parseFloat(rewardPoolData[rewardPoolData.length - 1]?.rewardPool || "0")).toLocaleString() : "0",
            trend: "up"
          },
          {
            label: "Projection Days",
            value: rewardPoolData.length.toString(),
            trend: "neutral"
          }
        ]}

        loading={projectionLoading}

      >
        <DateRangeButtons 
          selectedDays={futureMaxSupplyDays}
          onDaysChange={setFutureMaxSupplyDays}
        />
        <FutureMaxSupplyChart
          stakeEvents={stakeData}
          createEvents={createData}
          rewardPoolData={rewardPoolData}
          currentSupply={totalSupply}
          contractStartDate={CONTRACT_START_DATE}
          currentProtocolDay={currentProtocolDay}
          days={futureMaxSupplyDays}
          preCalculatedProjection={preCalculatedProjection}
        />
        <div className="chart-note">
          This projection shows the accrued future supply based on existing positions only. It includes principal returns from stakes and new tokens from creates that will be added when positions mature. This does NOT project future share rewards beyond what current positions have already earned. New positions created after today will dilute existing share percentages and reduce actual rewards.
        </div>
      </ExpandableChartSection>

      {/* Daily Creates vs Stakes Activity */}
      <ExpandableChartSection
        id="daily-creates-stakes"
        title="Number of Creates and Stakes Initiated Each Protocol Day"
        subtitle="Daily Creates vs Stakes Activity"
        chartType="bar"
        keyMetrics={[
          {
            label: "Total Creates",
            value: createData.length.toString(),
            trend: "up"
          },
          {
            label: "Total Stakes", 
            value: stakeData.length.toString(),
            trend: "up"
          },
          {
            label: "Most Active Day",
            value: dailyCreatesStakes.length > 0 ? 
              `Day ${dailyCreatesStakes.reduce((max, day) => 
                (day.creates + day.stakes) > (max.creates + max.stakes) ? day : max
              ).day}` : "N/A",
            trend: "neutral"
          },
          {
            label: "Total Days",
            value: currentProtocolDay.toString(),
            trend: "neutral"
          }
        ]}
        loading={chartsLoading}
      >
        <DateRangeButtons 
          selectedDays={dailyCreatesStakesDays}
          onDaysChange={setDailyCreatesStakesDays}
        />
        <PannableBarChart
          title="Daily Creates vs Stakes"
          labels={dailyCreatesStakes.map(d => [`Day ${d.day}`])}
          datasets={[
            {
              label: 'Creates',
              data: dailyCreatesStakes.map(d => d.creates),
              // backgroundColor will be set by gradient plugin
            },
            {
              label: 'Stakes',
              data: dailyCreatesStakes.map(d => d.stakes),
              // backgroundColor will be set by gradient plugin
            }
          ]}
          height={600}
          yAxisLabel="Number of Positions"
          xAxisLabel="Contract Day"
          windowSize={dailyCreatesStakesDays}
          showLegend={true}
          stacked={false}
          showDataLabels={true}
          formatTooltip={(value: number, datasetIndex?: number) => {
            const type = datasetIndex === 0 ? 'Creates' : 'Stakes';
            return `${value} ${type}`;
          }}
          formatYAxis={(value: number) => value.toString()}
        />
        <div className="chart-note">
          Shows the number of new create and stake positions initiated on each protocol day. Creates are positions that mint new TORUS tokens, while stakes are positions that lock existing TORUS tokens. Day 1 corresponds to the contract launch on July 10, 2025.
        </div>
      </ExpandableChartSection>

      {/* Future TORUS Supply Projection chart - Removed per user request
      <ExpandableChartSection
        id="supply-projection"
        title={<>Projected Supply Growth From Current Staked Positions Only - Does Not Include Future Daily <span className="torus-text">TORUS</span> Share Pool Distributions</>}
        subtitle="Future TORUS Supply Projection"
        keyMetrics={[
          {
            label: "Current Supply",
            value: totalSupply.toLocaleString(),
            trend: "neutral"
          },
          {
            label: "Projected Max",
            value: supplyProjection.slice(0, supplyProjectionDays).length > 0 ? 
              Math.round(supplyProjection.slice(0, supplyProjectionDays)[supplyProjection.slice(0, supplyProjectionDays).length - 1]?.supply || 0).toLocaleString() : "0",
            trend: "up"
          },
          {
            label: "Days Tracked",
            value: Math.min(supplyProjection.length, supplyProjectionDays),
            trend: "neutral"
          },
          {
            label: "Growth Rate",
            value: totalSupply > 0 && supplyProjection.slice(0, supplyProjectionDays).length > 0 ? 
              `${(((supplyProjection.slice(0, supplyProjectionDays)[supplyProjection.slice(0, supplyProjectionDays).length - 1]?.supply || 0) / totalSupply - 1) * 100).toFixed(1)}%` : 
              "0%",
            trend: "up"
          }
        ]}
        loading={chartsLoading}

      >
        <DateRangeButtons 
          selectedDays={supplyProjectionDays}
          onDaysChange={setSupplyProjectionDays}
        />
        <PannableLineChart
          key={`supply-projection-chart-pannable-${supplyProjection.length}-${supplyProjectionDays}`}
          title={<><span className="torus-text">TORUS</span> Supply from Current Share Pool ({supplyProjection.length} data points)</>}
          labels={supplyProjection.map(p => {
            const date = new Date(p.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          })}
          datasets={[
            {
              label: 'Total TORUS Supply',
              data: supplyProjection.map(p => Math.round(p.supply * 100) / 100),
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              fill: true,
            },
          ]}
          height={600}
          yAxisLabel="Total TORUS Supply"
          xAxisLabel="Date"
          customTooltipData={supplyProjection}
          customTooltipCallback={(context: any, data: any) => {
            const lines = [];
            lines.push(`Total Supply: ${data.supply.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TORUS`);
            lines.push(`Contract Day: ${data.contractDay}`);
            lines.push(`Daily Release: ${data.released.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TORUS`);
            lines.push(`  - Principal: ${data.principal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TORUS`);
            lines.push(`  - Rewards: ${data.rewards.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TORUS`);
            return lines;
          }}
          formatYAxis={(value: number) => {
            if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value/1000).toFixed(1)}K`;
            return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
          }}
          windowSize={supplyProjectionDays}
        />
        <div className="chart-note">
          <strong>Important:</strong> This projection shows how the total TORUS supply will grow as <em>currently staked positions</em> mature and release both principal and accrued rewards. Starting from current supply of {totalSupply.toLocaleString()} TORUS, the line tracks cumulative supply increases each day from existing stakes only. 
          <br /><br />
          <strong>Not Included:</strong> This projection does <em>not</em> factor in future daily TORUS share pool distributions that will be available for new staking. The actual future supply will likely be higher as new TORUS tokens are minted daily and distributed to the share pool for additional staking opportunities.
          <br /><br />
          <strong>Current Scope:</strong> Shows releases from {torusReleasesWithRewards.slice(0, supplyProjectionDays).filter(r => r.total > 0).length} positions maturing over the next {supplyProjectionDays} days, including their original principal and accumulated share rewards.
        </div>
      </ExpandableChartSection>
      */}

      <ExpandableChartSection
        id="torus-staked-per-day"
        title="Historical Staking Activity by Day"
        subtitle="Total TORUS Staked Each Contract Day"
        chartType="bar"
        keyMetrics={[
          {
            label: "Total Staked",
            value: `${totalStaked.toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS`,
            trend: "up"
          },
          {
            label: "Peak Day",
            value: torusStakedPerDay.slice(-torusStakedDays).length > 0 ? 
              `Day ${torusStakedPerDay.slice(-torusStakedDays).reduce((max, day) => day.amount > max.amount ? day : max, {day: 0, amount: 0}).day}` : 
              "N/A",
            trend: "up"
          },
          {
            label: "Active Days",
            value: torusStakedPerDay.slice(-torusStakedDays).filter(d => d.amount > 0).length,
            trend: "up"
          },
          {
            label: "Avg Daily",
            value: torusStakedPerDay.slice(-torusStakedDays).length > 0 ? 
              `${(torusStakedPerDay.slice(-torusStakedDays).reduce((sum, d) => sum + d.amount, 0) / torusStakedPerDay.slice(-torusStakedDays).filter(d => d.amount > 0).length).toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS` : 
              "0",
            trend: "neutral"
          }
        ]}

        loading={chartsLoading}

      >
        <DateRangeButtons 
          selectedDays={torusStakedDays}
          onDaysChange={setTorusStakedDays}
        />
        <PannableBarChart
          key="torus-staked-per-day-chart"
          title={<>Total <span className="torus-text">TORUS</span> Staked Each Contract Day</>}
          labels={torusStakedPerDay.map(d => [`Day ${d.day}`])}
          datasets={[
            {
              label: 'TORUS Staked',
              data: torusStakedPerDay.map(d => Math.round(d.amount * 100) / 100),
              // backgroundColor will be set by gradient plugin
            },
          ]}
          height={600}
          yAxisLabel="TORUS Amount"
          xAxisLabel="Contract Day"
          enableScaleToggle={true}
          formatTooltip={(value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} TORUS`}
          windowSize={torusStakedDays}
          showDataLabels={true}
        />
        <div className="chart-note">
          Shows the total amount of TORUS staked on each contract day from Day 1 to the current day. This represents the cumulative principal amounts from all stakes created on each specific day. Contract days start from Day 1 (July 10, 2025) when the TORUS protocol launched. Days with no staking activity show zero values.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="stake-maturity"
        title="Stakes Ending by Future Date"
        subtitle="Number of Stakes Ending Each Day"
        keyMetrics={[
          {
            label: "Active Stakes",
            value: activeStakes.toLocaleString(),
            trend: "up"
          },
          {
            label: "Peak Day",
            value: stakeReleases.slice(0, stakeMaturityDays).length > 0 ? 
              Math.max(...stakeReleases.slice(0, stakeMaturityDays).map(r => r.count)).toString() : 
              "0",
            trend: "up"
          },
          {
            label: "Next 30 Days",
            value: stakeReleases.slice(0, Math.min(30, stakeMaturityDays)).reduce((sum, r) => sum + r.count, 0).toString(),
            trend: "neutral"
          },
          {
            label: `Total in ${stakeMaturityDays}d`,
            value: stakeReleases.slice(0, stakeMaturityDays).reduce((sum, r) => sum + r.count, 0).toString(),
            trend: "neutral"
          }
        ]}

        loading={chartsLoading}

      >
        <DateRangeButtons 
          selectedDays={stakeMaturityDays}
          onDaysChange={setStakeMaturityDays}
        />
        <PannableBarChart
          key="stakes-maturity-chart"
          title="Number of Stakes Ending Each Day"
          labels={stakeReleases.map(r => {
            const contractDay = getContractDay(r.date);
            return [`${r.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'Number of Stakes',
              data: stakeReleases.map(r => r.count),
              backgroundColor: '#4f46e5',
            },
          ]}
          height={600}
          yAxisLabel="Number of Stakes"
          xAxisLabel="Date / Contract Day"
          enableScaleToggle={true}
          windowSize={stakeMaturityDays}
          showDataLabels={true}
        />
        <div className="chart-note">
          Shows the number of stakes that ended (historical) or will end (future) on each day from contract launch through 88 days into the future. The numbers on top of each bar indicate the exact count of stakes maturing that day. Stakes can be created for 1-88 days, so the distribution shows when users chose their maturity dates.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="create-maturity"
        title="Creates Ending by Future Date"
        subtitle="Number of Creates Ending Each Day"
        keyMetrics={[
          {
            label: "Active Creates",
            value: activeCreates.toLocaleString(),
            trend: "up"
          },
          {
            label: "Peak Day",
            value: createReleases.slice(0, torusReleasesDays).length > 0 ? 
              Math.max(...createReleases.slice(0, torusReleasesDays).map(r => r.count)).toString() : 
              "0",
            trend: "up"
          },
          {
            label: "Next 30 Days",
            value: createReleases.slice(0, Math.min(30, torusReleasesDays)).reduce((sum, r) => sum + r.count, 0).toString(),
            trend: "neutral"
          },
          {
            label: `Total in ${torusReleasesDays}d`,
            value: createReleases.slice(0, torusReleasesDays).reduce((sum, r) => sum + r.count, 0).toString(),
            trend: "neutral"
          }
        ]}

        loading={chartsLoading}

      >
        <DateRangeButtons 
          selectedDays={torusReleasesDays}
          onDaysChange={setTorusReleasesDays}
        />
        <PannableBarChart
          key="creates-maturity-chart"
          title="Number of Creates Ending Each Day"
          labels={createReleases.map(r => {
            const contractDay = getContractDay(r.date);
            return [`${r.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'Number of Creates',
              data: createReleases.map(r => r.count),
              // backgroundColor will be set by gradient plugin (pink)
            },
          ]}
          height={600}
          yAxisLabel="Number of Creates"
          xAxisLabel="Date / Contract Day"
          enableScaleToggle={true}
          windowSize={torusReleasesDays}
          showDataLabels={true}
        />
        <div className="chart-note">
          Shows the number of creates that ended (historical) or will end (future) on each day from contract launch through 88 days into the future. The numbers on top of each bar indicate the exact count of creates maturing that day. Creates can be made for 1-88 days, similar to stakes.
        </div>
      </ExpandableChartSection>


      <ExpandableChartSection
        id="torus-rewards"
        title="Principal vs Rewards Releasing Daily"
        subtitle="TORUS Released Each Day: Principal vs Accrued Share Rewards"
        keyMetrics={[
          {
            label: "Total Principal",
            value: `${torusReleasesWithRewards.slice(0, torusRewardsDays).reduce((sum, r) => sum + r.principal, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS`,
            trend: "up"
          },
          {
            label: "Total Rewards",
            value: `${torusReleasesWithRewards.slice(0, torusRewardsDays).reduce((sum, r) => sum + r.rewards, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS`,
            trend: "up"
          },
          {
            label: "Reward Ratio",
            value: torusReleasesWithRewards.slice(0, torusRewardsDays).length > 0 ? 
              (() => {
                const totalPrincipal = torusReleasesWithRewards.slice(0, torusRewardsDays).reduce((sum, r) => sum + r.principal, 0);
                const totalRewards = torusReleasesWithRewards.slice(0, torusRewardsDays).reduce((sum, r) => sum + r.rewards, 0);
                return totalPrincipal > 0 ? `${((totalRewards / totalPrincipal) * 100).toFixed(1)}%` : "0%";
              })() : 
              "0%",
            trend: "up"
          },
          {
            label: "Peak Day Total",
            value: torusReleasesWithRewards.slice(0, torusRewardsDays).length > 0 && torusReleasesWithRewards.slice(0, torusRewardsDays).some(r => r.total > 0) ? 
              `${Math.max(...torusReleasesWithRewards.slice(0, torusRewardsDays).map(r => r.total)).toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS` : 
              "0 TORUS",
            trend: "up"
          }
        ]}

        loading={chartsLoading}

      >
        <DateRangeButtons 
          selectedDays={torusRewardsDays}
          onDaysChange={setTorusRewardsDays}
        />
        <PannableBarChart
          key="torus-rewards-chart"
          title={<><span className="torus-text">TORUS</span> Released Each Day: Principal vs Accrued Share Rewards</>}
          labels={torusReleasesWithRewards
            .map(r => {
              const date = new Date(r.date);
              const contractDay = getContractDay(date);
              return [`${r.date.substring(5)}`, `Day ${contractDay}`];
            })}
          datasets={[
            {
              label: 'Principal TORUS',
              data: torusReleasesWithRewards
                .map(r => Math.round(r.principal * 100) / 100),
              // backgroundColor will be set by gradient plugin
            },
            {
              label: 'Accrued Rewards',
              data: torusReleasesWithRewards
                .map(r => Math.round(r.rewards * 100) / 100),
              // backgroundColor will be set by gradient plugin (pink)
            },
          ]}
          height={600}
          yAxisLabel="TORUS Amount"
          xAxisLabel="Date / Contract Day"
          enableScaleToggle={true}
          stacked={false}
          showLegend={true}
          formatTooltip={(value: number) => `TORUS: ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          minBarHeight={0}
          windowSize={torusRewardsDays}
          customLegendItems={[
            {
              label: 'Principal TORUS',
              color: 'linear-gradient(to top, #fbbf24, #ec4899, #8b5cf6)',
              logo: 'https://www.torus.win/torus.svg'
            },
            {
              label: 'Accrued Rewards',
              color: 'linear-gradient(to top, #fbbdd5, #ec4899)'
            }
          ]}
        />
        <div className="chart-note">
          Shows total TORUS released each day from positions that matured (historical) or will mature (future), spanning from contract launch through 88 days ahead. Purple bars show principal from stakes/creates ending. Pink bars show accrued share rewards that accumulated daily throughout each position's lifetime. Bars are shown side-by-side for easy comparison. Days with no releases show no bars. Rewards are estimated based on current pool data.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="titanx-usage"
        title={<><span style={{color: '#16a34a'}}>TitanX</span> Amounts From Creates Ending</>}
        subtitle="Total TitanX Used for Creates Ending Each Day"
        keyMetrics={[
          {
            label: "Total TitanX",
            value: `${titanXUsage.slice(0, titanXUsageDays).reduce((sum, r) => sum + r.amount, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} TITANX`,
            trend: "up"
          },
          {
            label: "Peak Day",
            value: titanXUsage.slice(0, titanXUsageDays).length > 0 ? 
              `${Math.max(...titanXUsage.slice(0, titanXUsageDays).map(r => r.amount)).toLocaleString('en-US', { maximumFractionDigits: 0 })} TITANX` : 
              "0",
            trend: "up"
          },
          {
            label: "Days with Usage",
            value: titanXUsage.slice(0, titanXUsageDays).filter(r => r.amount > 0).length,
            trend: "neutral"
          },
          {
            label: "Avg Daily",
            value: titanXUsage.slice(0, titanXUsageDays).length > 0 ? 
              `${(titanXUsage.slice(0, titanXUsageDays).reduce((sum, r) => sum + r.amount, 0) / titanXUsage.slice(0, titanXUsageDays).filter(r => r.amount > 0).length).toLocaleString('en-US', { maximumFractionDigits: 0 })} TITANX` : 
              "0",
            trend: "neutral"
          }
        ]}

        loading={chartsLoading}

      >
        <DateRangeButtons 
          selectedDays={titanXUsageDays}
          onDaysChange={setTitanXUsageDays}
        />
        <PannableBarChart
          key="titanx-usage-chart"
          title={<>Total <span style={{color: '#16a34a'}}>TitanX</span> Used for Creates Ending Each Day</>}
          labels={titanXUsage.map(r => {
            const contractDay = getContractDay(r.date);
            return [`${r.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'TitanX Amount',
              data: titanXUsage.map(r => Math.round(r.amount * 100) / 100),
              // backgroundColor will be set by gradient plugin (white to green)
            },
          ]}
          height={600}
          yAxisLabel="TitanX Amount"
          xAxisLabel="Date / Contract Day"
          formatTooltip={(value: number) => `TitanX: ${(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          enableScaleToggle={true}
          windowSize={titanXUsageDays}
        />
        <div className="chart-note">
          Shows the total TitanX amounts that were used for creates ending on each day, from contract launch through 88 days into the future. When users create positions, they pay TitanX as a fee. This chart displays the aggregate TitanX amounts from all creates that matured (historical) or will mature (future) on each specific day.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="daily-titanx-usage"
        title={<><span style={{color: '#16a34a'}}>TitanX</span> Used Each Day for Creates and Stakes</>}
        subtitle="Daily TitanX Usage - Creates vs Stakes"
        keyMetrics={[
          {
            label: "Total from Creates",
            value: `${dailyTitanXUsage.slice(0, dailyTitanXUsageDays).reduce((sum, r) => sum + r.creates, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} TITANX`,
            trend: "up"
          },
          {
            label: "Total from Stakes",
            value: `${dailyTitanXUsage.slice(0, dailyTitanXUsageDays).reduce((sum, r) => sum + r.stakes, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} TITANX`,
            trend: "up"
          },
          {
            label: "Peak Day Creates",
            value: dailyTitanXUsage.slice(0, dailyTitanXUsageDays).length > 0 ? 
              `${Math.max(...dailyTitanXUsage.slice(0, dailyTitanXUsageDays).map(r => r.creates)).toLocaleString('en-US', { maximumFractionDigits: 0 })} TITANX` : 
              "0",
            trend: "up"
          },
          {
            label: "Peak Day Stakes",
            value: dailyTitanXUsage.slice(0, dailyTitanXUsageDays).length > 0 ? 
              `${Math.max(...dailyTitanXUsage.slice(0, dailyTitanXUsageDays).map(r => r.stakes)).toLocaleString('en-US', { maximumFractionDigits: 0 })} TITANX` : 
              "0",
            trend: "up"
          }
        ]}
        loading={chartsLoading}
      >
        <DateRangeButtons 
          selectedDays={dailyTitanXUsageDays}
          onDaysChange={setDailyTitanXUsageDays}
        />
        <PannableBarChart
          key="daily-titanx-usage-chart"
          title={<>Daily <span style={{color: '#16a34a'}}>TitanX</span> Usage Breakdown</>}
          labels={dailyTitanXUsage.map(r => {
            const contractDay = getContractDay(r.date);
            return [`${r.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'TitanX from Creates',
              data: dailyTitanXUsage.map(r => Math.round(r.creates * 100) / 100),
              // backgroundColor will be set by gradient plugin (white to green)
            },
            {
              label: 'TitanX from Stakes',
              data: dailyTitanXUsage.map(r => Math.round(r.stakes * 100) / 100),
              backgroundColor: 'rgba(34, 197, 94, 0.7)', // Darker green for stakes
            },
          ]}
          height={600}
          yAxisLabel="TitanX Amount"
          xAxisLabel="Date / Contract Day"
          formatTooltip={(value: number) => `TitanX: ${(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          enableScaleToggle={true}
          windowSize={dailyTitanXUsageDays}
          showLegend={true}
        />
        <div className="chart-note">
          Shows the TitanX amounts used each day for both creates and stakes. When users create or stake positions, they pay TitanX as a fee. This chart displays the daily breakdown of TitanX usage across both operation types, helping visualize which type of activity drives more TitanX consumption.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="shares-releases"
        title="Shares Ending by Future Date"
        subtitle="Total Shares Ending Each Day"
        keyMetrics={[
          {
            label: `Total in ${sharesReleasesDays}d`,
            value: sharesReleases.slice(0, sharesReleasesDays).some(r => r.shares > 1e9) ? 
              `${(sharesReleases.slice(0, sharesReleasesDays).reduce((sum, r) => sum + r.shares, 0) / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B` :
              `${(sharesReleases.slice(0, sharesReleasesDays).reduce((sum, r) => sum + r.shares, 0) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`,
            trend: "up"
          },
          {
            label: "Peak Day",
            value: sharesReleases.slice(0, sharesReleasesDays).length > 0 ? 
              sharesReleases.slice(0, sharesReleasesDays).some(r => r.shares > 1e9) ? 
                `${(Math.max(...sharesReleases.slice(0, sharesReleasesDays).map(r => r.shares)) / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B` :
                `${(Math.max(...sharesReleases.slice(0, sharesReleasesDays).map(r => r.shares)) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M` : 
              "0",
            trend: "up"
          },
          {
            label: "Days with Shares",
            value: sharesReleases.slice(0, sharesReleasesDays).filter(r => r.shares > 0).length,
            trend: "neutral"
          },
          {
            label: "Active Total",
            value: totalShares > 1e12 ? 
              `${(totalShares / 1e12).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}T` :
              totalShares > 1e9 ? 
              `${(totalShares / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B` :
              `${(totalShares / 1e6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`,
            trend: "up"
          }
        ]}

        loading={chartsLoading}

      >
        <DateRangeButtons 
          selectedDays={sharesReleasesDays}
          onDaysChange={setSharesReleasesDays}
        />
        <PannableBarChart
          key="shares-releases-chart"
          title="Total Shares Ending Each Day"
          labels={sharesReleases.map(r => {
            const contractDay = getContractDay(r.date);
            return [`${r.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'Shares',
              data: sharesReleases.map(r => {
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
          windowSize={sharesReleasesDays}
          formatTooltip={(value: number) => {
            const selectedData = sharesReleases;
            const label = selectedData.some(r => r.shares > 1e9) ? 'B' : selectedData.some(r => r.shares > 1e6) ? 'M' : '';
            return `Shares: ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${label}`;
          }}
          enableScaleToggle={true}
          minBarHeight={2}
        />
        <div className="chart-note">
          Shows the total shares that ended (historical) or will end (future) on each day from contract launch through 88 days ahead. Shares represent the user's proportion of the reward pool and are earned from both stakes and creates. When positions mature, these shares are released and converted to TORUS rewards based on the share-to-TORUS ratio at maturity.
        </div>
      </ExpandableChartSection>

      {/* Buy & Process Charts Section */}
      <ExpandableChartSection
        id="daily-torus-burned"
        title={<><span className="torus-text">TORUS</span> Burned Through <span style={{color: '#f97316'}}>Buy & Burn</span> Operations</>}
        subtitle="TORUS Burned Per Day"
        keyMetrics={[
          {
            label: "Total Burned",
            value: buyProcessData ? 
              `${parseFloat(buyProcessData.totals.torusBurnt)
                .toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS` : 
              "0 TORUS",
            trend: "up"
          },
          {
            label: "Avg Daily Burn",
            value: dailyTorusBurned.length > 0 ? 
              `${(dailyTorusBurned.reduce((sum, d) => sum + d.amount, 0) / dailyTorusBurned.length).toFixed(2)} TORUS` : 
              "0 TORUS",
            trend: "neutral"
          },
          {
            label: "Days Active",
            value: dailyTorusBurned.filter(d => d.amount > 0).length,
            trend: "up"
          },
          {
            label: "Peak Burn Day",
            value: dailyTorusBurned.length > 0 ? 
              `${Math.max(...dailyTorusBurned.map(d => d.amount)).toFixed(2)} TORUS` : 
              "0 TORUS",
            trend: "up"
          }
        ]}
        loading={!buyProcessData}
      >
        <DateRangeButtons 
          selectedDays={torusBurnedDays}
          onDaysChange={setTorusBurnedDays}
        />
        <PannableBarChart
          key="daily-torus-burned-chart"
          title={<><span className="torus-text">TORUS</span> <span style={{color: '#f97316'}}>Burned</span> Per Day</>}
          labels={dailyTorusBurned.map(d => {
            const contractDay = getContractDay(d.date);
            return [`${d.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'TORUS Burned',
              data: dailyTorusBurned.map(d => d.amount),
              // backgroundColor will be set by gradient plugin
            },
          ]}
          height={600}
          yAxisLabel="TORUS Burned"
          xAxisLabel="Date / Contract Day"
          windowSize={torusBurnedDays}
          showDataLabels={true}
          formatTooltip={(value: number) => `${value.toFixed(2)} TORUS burned`}
        />
        <div className="chart-note">
          Shows daily TORUS burned through all mechanisms including Buy & Burn operations and LP fee collections. Each bar represents the total amount of TORUS permanently removed from circulation on that day. Data reflects actual burns verified on-chain.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="cumulative-torus-burned"
        title={<>Total <span className="torus-text">TORUS</span> Burned Over Time</>}
        subtitle="Cumulative TORUS Burned"
        keyMetrics={[
          {
            label: "Total Burned",
            value: buyProcessData ? 
              `${parseFloat(buyProcessData.totals.torusBurnt)
                .toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS` : 
              "0 TORUS",
            trend: "up"
          },
          {
            label: "Burn Rate",
            value: cumulativeTorusBurned.length > 1 ? 
              `${((cumulativeTorusBurned[cumulativeTorusBurned.length - 1].amount - cumulativeTorusBurned[cumulativeTorusBurned.length - 2].amount)).toFixed(2)} TORUS/day` : 
              "0 TORUS/day",
            trend: "up"
          },
          {
            label: "Total Operations",
            value: buyProcessData ? buyProcessData.eventCounts.buyAndBurn : 0,
            trend: "up"
          },
          {
            label: "LP Fee Burns",
            value: lpFeeBurnsData ? 
              `${parseFloat(lpFeeBurnsData.totals.torusBurned).toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS` : 
              "0 TORUS",
            trend: "up"
          }
        ]}
        loading={!buyProcessData}
      >
        <DateRangeButtons 
          selectedDays={cumulativeTorusBurnedDays}
          onDaysChange={setCumulativeTorusBurnedDays}
        />
        <PannableLineChart
          key="cumulative-torus-burned-chart"
          title={<>Cumulative <span className="torus-text">TORUS</span> <span style={{color: '#f97316'}}>Burned</span></>}
          labels={cumulativeTorusBurned.map(d => {
            const contractDay = getContractDay(d.date);
            return `${d.date.substring(5)} (Day ${contractDay})`;
          })}
          datasets={[
            {
              label: 'Total TORUS Burned',
              data: cumulativeTorusBurned.map(d => d.amount),
              borderColor: '#8b5cf6',  // Purple border to match TORUS branding
              backgroundColor: 'rgba(139, 92, 246, 0.3)',  // Purple fill with transparency
              fill: true,
            },
          ]}
          height={600}
          yAxisLabel="Total TORUS Burned"
          xAxisLabel="Date"
          windowSize={cumulativeTorusBurnedDays}
          formatTooltip={(value: number) => `${value.toFixed(2)} TORUS total`}
        />
        <div className="chart-note">
          Shows the cumulative total of TORUS burned over time. This reflects actual on-chain burns (Transfer events to 0x0), not the contract's inflated accounting. The upward slope indicates the rate of TORUS being permanently removed from circulation.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="buy-burn-activity"
        title={<>Daily <span style={{color: '#f97316'}}>Buy & Burn</span>/<span style={{color: '#f97316'}}>Build</span> Operations Count</>}
        subtitle="Daily Buy & Burn/Build Operations"
        keyMetrics={[
          {
            label: "Total Buy & Burn",
            value: buyProcessData ? buyProcessData.eventCounts.buyAndBurn : 0,
            trend: "up"
          },
          {
            label: "Total Buy & Build",
            value: buyProcessData ? buyProcessData.eventCounts.buyAndBuild : 0,
            trend: "up"
          },
          {
            label: "Most Active Day",
            value: buyBurnActivity.length > 0 ? 
              Math.max(...buyBurnActivity.map(d => d.buyAndBurn + d.buyAndBuild)) : 
              0,
            trend: "up"
          }
        ]}
        loading={!buyProcessData}
      >
        <DateRangeButtons 
          selectedDays={buyBurnActivityDays}
          onDaysChange={setBuyBurnActivityDays}
        />
        <PannableBarChart
          key="buy-burn-activity-chart"
          title={<>Daily <span style={{color: '#f97316'}}>Buy & Burn</span>/<span style={{color: '#f97316'}}>Build</span> Operations</>}
          labels={buyBurnActivity.map(d => {
            const contractDay = getContractDay(d.date);
            return [`${d.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'Buy & Burn',
              data: buyBurnActivity.map(d => d.buyAndBurn),
              // backgroundColor will be set by gradient plugin
            },
            {
              label: 'Buy & Build',
              data: buyBurnActivity.map(d => d.buyAndBuild),
              // backgroundColor will be set by gradient plugin
            },
          ]}
          height={600}
          yAxisLabel="Number of Operations"
          xAxisLabel="Date / Contract Day"
          windowSize={buyBurnActivityDays}
          showDataLabels={true}
          stacked={false}
          showLegend={true}
          customLegendItems={[
            {
              label: 'Buy & Burn',
              color: 'linear-gradient(to top, #fbbf24, #ec4899, #8b5cf6)',
              logo: 'https://www.torus.win/torus.svg'
            },
            {
              label: 'Buy & Build',
              color: 'linear-gradient(to top, #fbbdd5, #ec4899)'
            }
          ]}
        />
        <div className="chart-note">
          Shows the daily count of Buy & Burn and Buy & Build operations. Buy & Burn permanently removes TORUS from circulation, while Buy & Build purchases TORUS for protocol development.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="titanx-eth-usage"
        title={<>Resources Used in <span style={{color: '#f97316'}}>Buy & Burn</span> Operations</>}
        subtitle="Daily TitanX/ETH Used for Burns"
        keyMetrics={[
          {
            label: "Total TitanX Used",
            value: buyProcessData ? 
              `${(parseFloat(buyProcessData.totals.titanXUsedForBurns) / 1e9).toFixed(2)}B TitanX` : 
              "0 TitanX",
            trend: "up"
          },
          {
            label: "Total ETH Used",
            value: buyProcessData ? 
              `${parseFloat(buyProcessData.totals.ethUsedForBurns).toFixed(4)} ETH` : 
              "0 ETH",
            trend: "up"
          },
          {
            label: "Primary Currency",
            value: titanXEthUsage.reduce((sum, d) => sum + d.titanX, 0) > 0 ? "TitanX" : "ETH",
            trend: "neutral"
          }
        ]}
        loading={!buyProcessData}
      >
        <DateRangeButtons 
          selectedDays={titanXEthUsageDays}
          onDaysChange={setTitanXEthUsageDays}
        />
        <PannableBarChart
          key="titanx-eth-usage-chart"
          title={<>Daily <span style={{color: '#16a34a'}}>TitanX</span>/ETH Used for <span style={{color: '#f97316'}}>Burns</span></>}
          labels={titanXEthUsage.map(d => {
            const contractDay = getContractDay(d.date);
            return [`${d.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'TitanX Used',
              data: titanXEthUsage.map(d => d.titanX / 1e9), // Show in billions
              // backgroundColor will be set by gradient plugin
              yAxisID: 'y',
            },
            {
              label: 'ETH Used',
              data: titanXEthUsage.map(d => d.eth),
              // backgroundColor will be set by gradient plugin
              yAxisID: 'y1',
            },
          ]}
          height={600}
          yAxisLabel="TitanX (Billions)"
          xAxisLabel="Date / Contract Day"
          windowSize={titanXEthUsageDays}
          showDataLabels={false}
          formatTooltip={(value: number, datasetIndex?: number) => {
            if (datasetIndex === 0) {
              return `${value.toFixed(2)}B TitanX`;
            } else {
              return `${value.toFixed(4)} ETH`;
            }
          }}
          multipleYAxes={true}
          minBarHeight={2}
          showLegend={true}
          yAxis1Label="TitanX (Billions)"
          yAxis2Label="ETH"
          customLegendItems={[
            {
              label: 'TitanX Used',
              color: 'linear-gradient(to top, #ffffff, #16a34a)',
              logo: 'https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654'
            },
            {
              label: 'ETH Used',
              color: 'linear-gradient(to top, #60a5fa, #2563eb)',
              logo: '/eth-logo.svg'
            }
          ]}
        />
        <div className="chart-note">
          Shows the daily amount of TitanX (left axis in billions) and ETH (right axis) used specifically in Buy & Burn operations that permanently remove TORUS from circulation. This does not include TitanX/ETH used in Buy & Build operations which add liquidity to the protocol.
          {buyProcessData && parseFloat(buyProcessData.totals.ethUsedForBurns) > 0 && titanXEthUsage.every((d: { date: string; titanX: number; eth: number }) => d.eth === 0) && (
            <div style={{ marginTop: '8px', color: '#fbbf24', fontSize: '12px' }}>
              Note: {parseFloat(buyProcessData.totals.ethUsedForBurns).toFixed(4)} ETH was used in total, but daily breakdown is not available in the current data.
            </div>
          )}
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="titanx-eth-build-usage"
        title={<>Resources Used in <span style={{color: '#f97316'}}>Buy & Build</span> Operations</>}
        subtitle="Daily TitanX/ETH Used for Buy & Build"
        keyMetrics={[
          {
            label: "Total TitanX Used",
            value: buyProcessData && buyProcessData.totals.titanXUsedForBuilds ? 
              `${(parseFloat(buyProcessData.totals.titanXUsedForBuilds) / 1e9).toFixed(2)}B TitanX` : 
              "0 TitanX",
            trend: "up"
          },
          {
            label: "Total ETH Used",
            value: buyProcessData && buyProcessData.totals.ethUsedForBuilds ? 
              `${parseFloat(buyProcessData.totals.ethUsedForBuilds).toFixed(4)} ETH` : 
              "0 ETH",
            trend: "up"
          },
          {
            label: "Build Operations",
            value: buyProcessData ? buyProcessData.eventCounts.buyAndBuild : 0,
            trend: "up"
          }
        ]}
        loading={!buyProcessData}
      >
        <DateRangeButtons 
          selectedDays={titanXEthBuildUsageDays}
          onDaysChange={setTitanXEthBuildUsageDays}
        />
        <PannableBarChart
          key="titanx-eth-build-usage-chart"
          title={<>Daily <span style={{color: '#16a34a'}}>TitanX</span>/ETH Used for <span style={{color: '#f97316'}}>Buy & Build</span></>}
          labels={titanXEthBuildUsage.map(d => {
            const contractDay = getContractDay(d.date);
            return [`${d.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'TitanX Used',
              data: titanXEthBuildUsage.map(d => d.titanX / 1e9), // Show in billions
              // backgroundColor will be set by gradient plugin
              yAxisID: 'y',
            },
            {
              label: 'ETH Used',
              data: titanXEthBuildUsage.map(d => d.eth),
              // backgroundColor will be set by gradient plugin
              yAxisID: 'y1',
            },
          ]}
          height={600}
          yAxisLabel="TitanX (Billions)"
          xAxisLabel="Date / Contract Day"
          windowSize={titanXEthBuildUsageDays}
          showDataLabels={false}
          formatTooltip={(value: number, datasetIndex?: number) => {
            if (datasetIndex === 0) {
              return `${value.toFixed(2)}B TitanX`;
            } else {
              return `${value.toFixed(4)} ETH`;
            }
          }}
          multipleYAxes={true}
          minBarHeight={2}
          showLegend={true}
          yAxis1Label="TitanX (Billions)"
          yAxis2Label="ETH"
          customLegendItems={[
            {
              label: 'TitanX Used',
              color: 'linear-gradient(to top, #ffffff, #16a34a)',
              logo: 'https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654'
            },
            {
              label: 'ETH Used',
              color: 'linear-gradient(to top, #60a5fa, #2563eb)',
              logo: '/eth-logo.svg'
            }
          ]}
        />
        <div className="chart-note">
          Shows the daily amount of TitanX (left axis in billions) and ETH (right axis) used in Buy & Build operations. These operations purchase TORUS to add liquidity to the protocol rather than burning it. The remaining TORUS after liquidity provision is burned.
        </div>
      </ExpandableChartSection>

      <ExpandableChartSection
        id="lp-fee-burns"
        title={<><span style={{color: '#16a34a'}}>TitanX</span> Collected From LP Fees and Sent to <span style={{color: '#f97316'}}>Buy & Burn</span> Operations</>}
        subtitle="LP Fee Collections and Buy & Burn Activity"
        keyMetrics={[
          {
            label: "Total LP Fee Burns",
            value: lpFeeBurnsData ? 
              `${parseFloat(lpFeeBurnsData.totals.torusBurned).toLocaleString('en-US', { maximumFractionDigits: 0 })} TORUS` : 
              "0 TORUS",
            trend: "up"
          },
          {
            label: "Fee Collections",
            value: lpFeeBurnsData ? lpFeeBurnsData.totals.feeCollections : 0,
            trend: "up"
          },
          {
            label: "Total TitanX Collected",
            value: lpFeeBurnsData ? 
              `${(parseFloat(lpFeeBurnsData.totals.titanxCollected) / 1e9).toFixed(2)}B TitanX` : 
              "0 TitanX",
            trend: "up"
          },
          {
            label: "Avg TitanX per Collection",
            value: lpFeeBurnsData && lpFeeBurnsData.totals.feeCollections > 0 ? 
              `${(parseFloat(lpFeeBurnsData.totals.titanxCollected) / lpFeeBurnsData.totals.feeCollections / 1e9).toFixed(2)}B TitanX` : 
              "0 TitanX",
            trend: "up"
          }
        ]}
        loading={!lpFeeBurnsData}
      >
        <DateRangeButtons 
          selectedDays={lpFeeBurnsDays}
          onDaysChange={setLpFeeBurnsDays}
        />
        <PannableBarChart
          key="lp-fee-burns-chart"
          title={<>LP Fee Collections and <span style={{color: '#f97316'}}>Buy & Burn</span> Activity</>}
          labels={lpFeeBurns.map(d => {
            const contractDay = getContractDay(d.date);
            return [`${d.date.substring(5)}`, `Day ${contractDay}`];
          })}
          datasets={[
            {
              label: 'TORUS Burned',
              data: lpFeeBurns.map(d => d.torusBurned),
              yAxisID: 'y',
              // backgroundColor will be set by gradient plugin
            },
            {
              label: 'TitanX Collected (Billions)',
              data: lpFeeBurns.map(d => d.titanxCollected),
              yAxisID: 'y1',
              // backgroundColor will be set by gradient plugin
            },
          ]}
          height={600}
          yAxisLabel="TORUS Burned"
          xAxisLabel="Date / Contract Day"
          windowSize={lpFeeBurnsDays}
          showDataLabels={true}
          formatTooltip={(value: number, datasetIndex?: number) => {
            if (datasetIndex === 0) {
              return `${value.toFixed(2)} TORUS`;
            } else {
              return `${value.toFixed(2)}B TitanX`;
            }
          }}
          stacked={false}
          multipleYAxes={true}
          showLegend={true}
          yAxis1Label="TORUS Burned"
          yAxis2Label="TitanX Collected (Billions)"
          customLegendItems={[
            {
              label: 'TORUS Burned',
              color: 'linear-gradient(to top, #fbbf24, #ec4899, #8b5cf6)',
              logo: 'https://www.torus.win/torus.svg'
            },
            {
              label: 'TitanX Collected (Billions)',
              color: 'linear-gradient(to top, #ffffff, #16a34a)',
              logo: 'https://coin-images.coingecko.com/coins/images/32762/large/TitanXpng_%281%29.png?1704456654'
            }
          ]}
        />
        <div className="chart-note">
          Shows LP fee collection activity from the protocol's Uniswap V3 position #1029195. When fees are collected, the TORUS portion is immediately burned (100% burn rate), while the TitanX portion is sent to the Buy & Process contract for future buy & burn operations. Fee collection is a manual, permissionless process that anyone can trigger.
        </div>
      </ExpandableChartSection>

      {/* LP Positions Section */}
      <ExpandableChartSection
        id="lp-positions"
        title={<>Active Liquidity Positions on <span style={{color: '#3b82f6'}}>Uniswap V3</span></>}
        subtitle="Uniswap V3 Liquidity Providers"
        keyMetrics={[
          {
            label: "Total Positions",
            value: lpPositions.length,
            trend: "neutral"
          },
          {
            label: "Pool Type",
            value: "TORUS/TitanX",
            trend: "neutral"
          },
          {
            label: "Protocol",
            value: "Uniswap V3",
            trend: "neutral"
          },
          {
            label: "Status",
            value: lpLoading ? "Loading..." : "Active",
            trend: lpLoading ? "neutral" : "up"
          }
        ]}

        loading={lpLoading}

      >
        <LPPositionsTable 
          positions={lpPositions} 
          loading={lpLoading}
          tokenInfo={lpTokenInfo || { token0IsTorus: true, token0IsTitanX: false }}
        />
      </ExpandableChartSection>

      
      {!loading && stakeData.length === 0 && createData.length === 0 && (
        <div className="error-container">
          <h3>No blockchain data available</h3>
          <p>Unable to fetch live data. Please check your connection or try refreshing.</p>
        </div>
      )}
      
      {/* Community Disclaimer */}
      {/* Enterprise-Level Footer */}
      <footer className="dashboard-footer">
        {/* Data Status Bar */}
        <div className="footer-data-status">
          <div className="footer-data-status-content">
            <div className="data-status-item">
              <div className="status-indicator"></div>
              <div className="data-status-text">
                <span className="data-status-label">System Status</span>
                <span className="data-status-value">Live Data Active</span>
              </div>
            </div>
            
            <div className="data-status-item">
              <div className="data-status-text">
                <span className="data-status-label">Data Source</span>
                <span className="data-status-value">
                  {loading ? 'Loading...' : `Ethereum Mainnet • ${stakeData.length} Stakes • ${createData.length} Creates`}
                </span>
              </div>
            </div>
            
            <div className="data-status-item">
              <div className="data-status-text">
                <span className="data-status-label">Last Updated</span>
                <span className="data-status-value">
                  {lastUpdatedTime ? 
                    new Date(lastUpdatedTime).toLocaleString() : 
                    'Syncing...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="footer-main-content">
          <div className="footer-content">

            {/* Contract Addresses */}
            <div className="footer-section">
              <h4>Smart Contracts</h4>
              <div className="footer-links">
                <div className="contract-item">
                  <span className="contract-label">TORUS Token</span>
                  <a 
                    href="https://etherscan.io/address/0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="contract-address-link"
                  >
                    0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                  </a>
                </div>
                
                <div className="contract-item">
                  <span className="contract-label">Create & Stake</span>
                  <a 
                    href="https://etherscan.io/address/0xc7Cc775B21f9Df85E043C7FDd9dAC60af0B69507" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="contract-address-link"
                  >
                    0xc7Cc775B21f9Df85E043C7FDd9dAC60af0B69507
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                  </a>
                </div>
                
                <div className="contract-item">
                  <span className="contract-label">Buy & Process</span>
                  <a 
                    href="https://etherscan.io/address/0xAa390a37006E22b5775A34f2147F81eBD6a63641" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="contract-address-link"
                  >
                    0xAa390a37006E22b5775A34f2147F81eBD6a63641
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Official Links */}
            <div className="footer-section">
              <h4>Official Links</h4>
              <div className="footer-links">
                <a 
                  href="https://www.torus.win/earn" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  <img src="https://www.torus.win/torus.svg" alt="TORUS" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
                  TORUS Dashboard
                </a>
                <a 
                  href="https://docs.torus.win/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  <img src="https://www.torus.win/torus.svg" alt="TORUS" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
                  Documentation
                </a>
                <a 
                  href="https://t.me/toruswin" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                  </svg>
                  Telegram Community
                </a>
              </div>
            </div>

            {/* Trading & Analytics */}
            <div className="footer-section">
              <h4>Trading & Analytics</h4>
              <div className="footer-links">
                <a 
                  href="https://dexscreener.com/ethereum/0x7ff1f30f6e7eec2ff3f0d1b60739115bdf88190f" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  <img src="https://dexscreener.com/favicon.png" alt="DexScreener" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
                  TORUS/TitanX Chart
                </a>
                <a 
                  href="https://etherscan.io/token/tokenholderchart/0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  <img src="https://www.torus.win/torus.svg" alt="TORUS" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
                  Token Holders
                </a>
                <a 
                  href="https://app.uniswap.org/explore/pools/ethereum/0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  <img src="https://app.uniswap.org/favicon.png" alt="Uniswap" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
                  Uniswap V3 Pool
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <div className="footer-copyright">
              © 2025 TORUS Community Dashboard.
            </div>
          </div>
        </div>
      </footer>
      
    </Dashboard>
    </>
  );
}

export default App;
