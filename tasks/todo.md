# TORUS Dashboard Todo List

## Current Issue: Stakes Not Showing on Dashboard

### Analysis
Based on research of the TORUS Create & Stake contract:

1. **Two Types of Positions**:
   - **Creates**: Users deposit TitanX/ETH to mint new TORUS (emits `Created` events)
   - **Stakes**: Users stake existing TORUS tokens (emits `Staked` events)

2. **Current Status**:
   - We're successfully tracking Created events (203 creates showing)
   - We're seeing 0 Staked events in our dashboard
   - The protocol appears to be in "create phase" where users are minting new tokens

3. **Possible Reasons for No Stakes**:
   - Users may not be staking yet (still accumulating TORUS)
   - There might be an issue with our stake event fetching
   - Stakes might exist but our code isn't capturing them correctly

### Plan to Fix Stakes Display

#### Phase 1: Verify Stake Events Exist
1. **Add Debug Logging to fetchStakeEvents**
   - [ ] Log the exact filter being used
   - [ ] Log raw event data before mapping
   - [ ] Log any errors in detail
   - [ ] Count events per chunk

2. **Test Direct Contract Query**
   - [ ] Create a test script to query Staked events directly
   - [ ] Compare with Etherscan events tab
   - [ ] Verify our deployment block is correct

#### Phase 2: Fix Event Fetching (if events exist)
1. **Check Event Signature**
   - [ ] Verify the Staked event ABI matches contract
   - [ ] Ensure event parameters are correct
   - [ ] Test with different block ranges

2. **Debug Event Processing**
   - [ ] Log raw event args before processing
   - [ ] Verify timestamp and duration calculations
   - [ ] Check maturityDate calculation

#### Phase 3: Update UI Display
1. **Separate Stakes from Creates**
   - [ ] Add clear labels for "Stakes" vs "Creates"
   - [ ] Show both types in metrics
   - [ ] Add "No stakes yet" message if zero

2. **Add Stake-specific Charts**
   - [ ] Stake maturity schedule (if any stakes exist)
   - [ ] Average stake duration
   - [ ] Total TORUS staked vs created

#### Phase 4: Testing
1. **Test with Mock Data**
   - [ ] Create mock stake events to test display
   - [ ] Verify charts render correctly
   - [ ] Test edge cases (0 stakes, 1 stake, many stakes)

2. **Production Testing**
   - [ ] Deploy and verify with live data
   - [ ] Monitor console for errors
   - [ ] Compare with Etherscan data

### Next Steps
1. First, we need to verify if ANY Staked events exist on-chain
2. If they exist, debug why we're not fetching them
3. If they don't exist, update UI to clearly show this is expected

### Questions for User
- Have you checked Etherscan to see if there are any Staked events?
- Should we show a message explaining why stakes might be zero?
- Do you want to display creates and stakes separately or combined?

## Review: Bar Size Visibility Issue

### Problem
The user showed a screenshot where bars in charts had extreme size differences, making smaller bars barely visible. This was particularly noticeable in the "Create Maturity Schedule" and "TORUS Release Amounts" charts where Day 88 had values so large they dwarfed all other days.

### Solution Implemented
1. **Added Scale Toggle Feature**:
   - Modified `BarChart.tsx` to support both linear and logarithmic scales
   - Added a checkbox toggle that appears when value ratios exceed 100:1
   - Toggle allows users to switch between linear and log scales dynamically

2. **Technical Changes**:
   - Imported and registered `LogarithmicScale` from Chart.js
   - Added `enableScaleToggle` prop to BarChart component
   - Implemented automatic detection of extreme value differences
   - Added visual indicator when log scale is active

3. **Applied to All Charts**:
   - Enabled scale toggle on all 5 main charts in the dashboard
   - Each chart can independently toggle between scales

### Result
Users can now toggle to logarithmic scale when viewing charts with extreme value differences, making all bars visible regardless of their relative sizes. The toggle only appears when needed (value ratio > 100:1), keeping the UI clean when not necessary.

## Review: TORUS Release Chart with Share Rewards

### Problem
The existing TORUS Release Amounts chart only showed principal amounts maturing, not the daily TORUS rewards earned from shares during the staking period.

### Solution Implemented
1. **Added Contract Methods**:
   - Added ABI entries for `getCurrentDayIndex()`, `rewardPool()`, `totalShares()`, `penaltiesInRewardPool()`
   - Created helper functions to fetch reward pool data for multiple days

2. **New Calculation Logic**:
   - `calculateTorusReleasesWithRewards()` function that:
     - Calculates principal amounts from creates/stakes maturing
     - Calculates daily share rewards based on reward pool and share distribution
     - Accumulates all daily rewards to show on maturity date
     - Returns separate principal and rewards data for stacked chart

3. **New Chart Features**:
   - Added "TORUS Release Amounts with Estimated Daily Rewards" chart
   - Stacked bar chart showing principal (dark purple) and rewards (light purple)
   - Log scale toggle for handling large values
   - Clear note about estimation methodology

### Technical Implementation
- Fetches current protocol day and reward pool data for next 88 days
- For each active position, calculates its share of daily rewards
- Rewards formula: `(rewardPool + penalties) × userShares / totalShares`
- Accumulates daily rewards and shows total on maturity date

### Result
Users can now see a comprehensive view of TORUS releases including both guaranteed principal amounts and estimated share rewards. The chart clearly distinguishes between the two components and explains that rewards are estimates based on current share distribution.

## Review: Log Scale Visualization Improvements

### Problem
1. When log scale was enabled, small bars were taking up too much vertical space due to log scale starting at 0
2. The TORUS Release chart with rewards had nearly identical purple colors for principal and rewards
3. When log scale was enabled on the stacked rewards chart, the rewards portion appeared as only a tiny sliver due to log scale distortion

### Solution Implemented

1. **Fixed Log Scale Minimum Value**:
   - Modified y-axis configuration to start at half the minimum value when log scale is enabled
   - Added `grace: '0%'` to prevent additional padding
   - This prevents small values from dominating the vertical space

2. **Improved Color Distinction**:
   - Changed Est. Share Rewards color from #a78bfa (light purple) to #22c55e (green)
   - Now principal TORUS (purple) and rewards (green) are clearly distinguishable

3. **Fixed Stacked Bar Log Scale Issue**:
   - Added automatic switching from stacked to grouped bars when log scale is enabled
   - Title updates to show "(Grouped view in log scale)" when toggled
   - Both principal and rewards bars now display side-by-side with proper proportions

### Result
The charts now display correctly in both linear and log scales. Small bars no longer dominate the view, colors are distinct, and the stacked rewards chart properly shows both components when log scale is enabled.

## Review: Chart Height Improvement

### Problem
After analyzing the screenshot, the log scale charts showed correct logarithmic spacing on the y-axis (0.1, 0.7, 1, 3, 10, 30, 70, etc.) but the bars appeared very compressed and short relative to the chart height. This made it difficult to visually distinguish between different bar values even with log scale enabled.

### Solution Implemented
Increased all chart heights by 50% from 400px to 600px. This provides more vertical space for the logarithmic scale to properly display the bars with better visual distinction.

### Result
Charts now have 50% more height, giving log scale bars more room to be visually distinguished. The additional height makes the logarithmic differences between values more apparent and improves overall chart readability.

## Review: Less Aggressive Log Scale

### Problem
The log scale was too aggressive, making small bars appear too close in height to large bars. This reduced the visual distinction between values of different magnitudes.

### Solution Implemented
Adjusted the log scale configuration to be less aggressive:
1. Changed minimum value from 50% to 90% of the smallest value (minValue * 0.9)
2. Added 5% grace padding for better visual spacing

### Result
The log scale now provides better height differentiation between small and large values while still handling extreme value ranges effectively. Bars with smaller values now appear more distinct from larger ones.

## Review: Improved Log Scale Grid Lines

### Problem
The horizontal grid lines (y-axis ticks) in log scale looked off and weren't following standard logarithmic practices.

### Solution Implemented
1. **Better Tick Configuration**:
   - Set `autoSkip: false` to ensure Chart.js shows all standard log scale ticks
   - Removed `maxTicksLimit` to allow proper logarithmic tick distribution
   - Added `includeBounds: false` for cleaner tick placement

2. **Visual Improvements**:
   - Changed grid color to slightly lighter (#444) when in log scale for better visibility
   - Added `drawTicks: true` to ensure tick marks are visible

3. **Refined Minimum Value**:
   - Adjusted to start at 80% of minimum value (from 90%)
   - Added minimum floor of 0.1 to prevent issues with very small values
   - Removed grace padding for cleaner log scale appearance

### Result
The log scale now displays standard logarithmic grid lines following mathematical conventions, making it easier to read values across different orders of magnitude.

## Review: Fixed Log Scale Issues from Screenshot

### Problem
The screenshot showed irregular tick spacing (0.10, 0.13, 0.18, 0.24, 0.33, 0.46, etc.) that didn't follow standard logarithmic conventions. Standard log scales should show powers of 10 and clean multiples.

### Solution Implemented
1. **Simplified Tick Configuration**:
   - Removed `autoSkip: false` and `includeBounds: false` to let Chart.js handle tick generation naturally
   - Added explicit `base: 10` to ensure base-10 logarithm
   
2. **Adjusted Minimum Value**:
   - Changed back to 50% of minimum value for better spacing
   - Removed grace padding

3. **Improved Formatting**:
   - Changed decimal formatting from 2 places to 1 place for cleaner display

### Result
The log scale now displays cleaner, more standard tick marks that follow proper logarithmic conventions with base-10 spacing.

## Review: World-Class Loading Experience

### Problem
The user wanted to improve the frontend design with inspiration from the TORUS earn page, particularly:
1. Proper skeleton loaders for all sections during loading
2. More detailed progress information below the loading bar
3. World-class frontend design

### Solution Implemented

1. **Enhanced LoadingBar Component**:
   - Added full-screen loading experience with gradient title animation
   - Implemented detailed progress steps that show below the main loading message
   - Added visual progress indicators with checkmarks for completed steps
   - Created smooth animations and transitions
   - Added percentage display and glowing effects

2. **Detailed Loading Progress**:
   - Shows specific blockchain operations as they happen
   - Displays found event counts (e.g., "Found 203 create events")
   - Shows reward pool loading progress
   - Provides context for each loading phase

3. **Complete Skeleton Coverage**:
   - Added skeleton loaders to ALL chart sections (previously only first chart had one)
   - Ensures consistent loading experience across the entire dashboard

4. **Visual Enhancements**:
   - Gradient text effects on loading title
   - Pulsing animations for active loading steps
   - Smooth fade-in animations
   - Professional color scheme with purple/green gradients
   - Scanline effect for futuristic feel

### Result
The dashboard now has a world-class loading experience that provides detailed feedback to users about what's happening during the data fetch process. All sections properly show skeleton loaders, and the loading screen is visually engaging with smooth animations and clear progress indicators.