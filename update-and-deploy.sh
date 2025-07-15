#!/bin/bash

# TORUS Dashboard - Automated Update and Deploy Script
# This script updates the dashboard data and pushes to GitHub for Vercel deployment

echo "🚀 TORUS Dashboard Automated Update"
echo "==================================="

# 1. Run the comprehensive data update script
echo "📊 Step 1: Updating dashboard data..."
node scripts/data-updates/update-all-dashboard-data.js

# Check if the update was successful
if [ $? -ne 0 ]; then
    echo "❌ Error: Data update failed!"
    exit 1
fi

echo "✅ Data update completed successfully"

# 2. Run the LP position fix to ensure accurate calculations
echo "🔧 Step 2: Fixing LP position calculations..."
node fetch-all-lp-positions.js
if [ $? -eq 0 ]; then
    node fix-lp-positions-simple.js
fi

# 3. Check git status
echo "📝 Step 3: Checking git status..."
git status --porcelain

# 4. Add and commit changes
if [[ `git status --porcelain` ]]; then
    echo "📦 Step 4: Committing changes..."
    
    # Add the updated JSON file
    git add public/data/cached-data.json
    
    # Create commit with timestamp
    TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    git commit -m "Automated dashboard data update - $TIMESTAMP

- Updated all dashboard metrics
- Refreshed LP positions with accurate calculations
- Updated token prices and pool data
- Refreshed reward pool data

🤖 Generated with automated update script" || { echo "❌ Commit failed"; exit 1; }
    
    echo "✅ Changes committed"
    
    # 5. Push to GitHub
    echo "🌐 Step 5: Pushing to GitHub..."
    git push origin master || { echo "❌ Push failed"; exit 1; }
    
    echo "✅ Successfully pushed to GitHub"
    echo ""
    echo "🎉 Update complete! Vercel will automatically deploy the changes."
    echo "   Visit your Vercel dashboard to monitor the deployment."
else
    echo "ℹ️  No changes detected. Dashboard data is already up to date."
fi

echo ""
echo "📊 Summary:"
echo "   - Data last updated: $(date -u)"
echo "   - Branch: master"
echo "   - Auto-deployment: Enabled via Vercel"