#!/bin/bash

# Monitor script for 5-minute update performance

echo "📊 TORUS Dashboard 5-Minute Update Monitor"
echo "=========================================="
echo ""

# Check last 10 update times
echo "🕐 Recent update times:"
grep "Auto-Update" logs/auto-update-fixed.log 2>/dev/null | tail -10 | awk '{print $1 " " $2}'

echo ""
echo "📈 Update frequency analysis:"
# Count updates in last hour
LAST_HOUR=$(date -d "1 hour ago" +%Y-%m-%dT%H)
COUNT=$(grep "$LAST_HOUR" logs/auto-update-fixed.log 2>/dev/null | grep "Auto-Update" | wc -l)
echo "  Updates in last hour: $COUNT (expected: ~12)"

# Check for errors
echo ""
echo "❌ Recent errors (if any):"
grep -E "Error|Failed|failed" logs/auto-update-fixed.log 2>/dev/null | tail -5

# Check average execution time
echo ""
echo "⏱️  Performance check:"
if [ -f logs/auto-update-fixed.log ]; then
    # Check if updates are completing
    RECENT_COMPLETES=$(grep "completed successfully" logs/auto-update-fixed.log 2>/dev/null | tail -5 | wc -l)
    echo "  Recent successful completions: $RECENT_COMPLETES/5"
fi

# Check disk space (important for frequent commits)
echo ""
echo "💾 Disk space:"
df -h . | grep -v Filesystem

# Check git status
echo ""
echo "📦 Git repository status:"
git status --porcelain | wc -l | xargs -I {} echo "  Uncommitted files: {}"

echo ""
echo "✅ Monitor complete. Updates should occur every 5 minutes."