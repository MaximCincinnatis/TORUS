#!/bin/bash

# Update script with monitoring
# This ensures we catch any data integrity issues immediately

echo "🚀 Starting update cycle at $(date)"

# Run the update
npm run update

# Check data integrity
node scripts/verify-data-integrity.js
if [ $? -ne 0 ]; then
  echo "❌ Data integrity check failed!"
  exit 1
fi

# Monitor for historical data changes
node scripts/monitor-data-changes.js
if [ $? -ne 0 ]; then
  echo "⚠️  Historical data was modified unexpectedly!"
  # Could add email/slack notification here
fi

echo "✅ Update cycle completed at $(date)"