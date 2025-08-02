# Clean Data Rebuild

## Purpose
Rebuild all dashboard data from scratch in a clean environment without modifying existing code.

## Structure
```
clean-rebuild/
├── scripts/       # Copies of existing scripts
├── data/         # Fresh JSON data files
├── logs/         # Execution logs
└── README.md     # This file
```

## Process
1. Copy necessary scripts from main project
2. Create empty data structure
3. Run scripts in correct order
4. Test with frontend
5. If successful, replace production data

## Scripts Execution Order
1. `update-all-dashboard-data.js` - Full blockchain data fetch
2. `comprehensive-payment-matching.js` - Match TitanX payments
3. `update-buy-process-data.js` - Buy & process events
4. `update-creates-stakes-incremental.js` - Ensure latest data

## Data Files
- `cached-data.json` - Main dashboard data
- `buy-process-data.json` - Buy & burn/build data
- `buy-process-burns.json` - LP fee burns