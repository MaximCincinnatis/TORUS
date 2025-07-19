/**
 * Historical Supply Tracker
 * 
 * Tracks daily TORUS supply snapshots to maintain accurate historical data
 * for the Future TORUS Max Supply Projection chart
 */

export interface DailySupplySnapshot {
  day: number;
  date: string;
  totalSupply: number;
  circulatingSupply: number;
  burnedSupply: number;
  timestamp: string;
}

export interface HistoricalSupplyData {
  snapshots: DailySupplySnapshot[];
  lastUpdated: string;
  contractStartDate: string;
}

/**
 * Load historical supply data from localStorage or initialize
 */
export function loadHistoricalSupplyData(): HistoricalSupplyData {
  const stored = localStorage.getItem('torus_historical_supply');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing historical supply data:', e);
    }
  }
  
  // Initialize with contract start date
  return {
    snapshots: [],
    lastUpdated: new Date().toISOString(),
    contractStartDate: '2025-07-11T00:00:00Z' // TORUS contract start date
  };
}

/**
 * Save historical supply data to localStorage
 */
export function saveHistoricalSupplyData(data: HistoricalSupplyData): void {
  localStorage.setItem('torus_historical_supply', JSON.stringify(data));
}

/**
 * Update or add a daily snapshot
 */
export function updateDailySnapshot(
  day: number,
  totalSupply: number,
  burnedSupply: number = 0
): void {
  const data = loadHistoricalSupplyData();
  const date = calculateDateForDay(day, data.contractStartDate);
  
  // Find existing snapshot or create new one
  const existingIndex = data.snapshots.findIndex(s => s.day === day);
  const snapshot: DailySupplySnapshot = {
    day,
    date: date.toISOString().split('T')[0],
    totalSupply,
    circulatingSupply: totalSupply - burnedSupply,
    burnedSupply,
    timestamp: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    // Update existing snapshot only if newer data
    data.snapshots[existingIndex] = snapshot;
  } else {
    // Add new snapshot and sort by day
    data.snapshots.push(snapshot);
    data.snapshots.sort((a, b) => a.day - b.day);
  }
  
  data.lastUpdated = new Date().toISOString();
  saveHistoricalSupplyData(data);
}

/**
 * Get snapshot for a specific day
 */
export function getSnapshotForDay(day: number): DailySupplySnapshot | null {
  const data = loadHistoricalSupplyData();
  return data.snapshots.find(s => s.day === day) || null;
}

/**
 * Get the most recent snapshot before or on a specific day
 */
export function getLatestSnapshotBeforeDay(day: number): DailySupplySnapshot | null {
  const data = loadHistoricalSupplyData();
  const validSnapshots = data.snapshots.filter(s => s.day <= day);
  
  if (validSnapshots.length === 0) return null;
  
  // Return the latest one
  return validSnapshots[validSnapshots.length - 1];
}

/**
 * Calculate date for a protocol day
 */
function calculateDateForDay(day: number, contractStartDate: string): Date {
  const startDate = new Date(contractStartDate);
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + day - 1); // Day 1 is contract start date
  return targetDate;
}

/**
 * Get all historical snapshots
 */
export function getAllSnapshots(): DailySupplySnapshot[] {
  const data = loadHistoricalSupplyData();
  return data.snapshots;
}

/**
 * Clear all historical data (use with caution)
 */
export function clearHistoricalData(): void {
  localStorage.removeItem('torus_historical_supply');
}