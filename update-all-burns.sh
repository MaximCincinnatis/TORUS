#!/bin/bash

# Update all burn-related data
echo "🔥 Updating all burn data..."

# Update regular buy & process data
echo "📊 Updating Buy & Process data..."
node scripts/update-buy-process-data.js

# Update LP fee burns
echo "💧 Updating LP Fee Burns data..."
node update-lp-fee-burns.js

echo "✅ All burn data updated!"