# TORUS Dashboard Deployment Guide

## Automated Update Process

### Quick Update Command
```bash
node auto-update.js
```

This single command will:
1. ✅ Update all dashboard data from blockchain
2. ✅ Fix LP position calculations
3. ✅ Commit changes to git
4. ✅ Push to GitHub
5. ✅ Trigger automatic Vercel deployment

### Alternative: Shell Script
```bash
./update-and-deploy.sh
```

## Vercel Configuration

### Setting Up Auto-Deployment

1. **Connect GitHub to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import the GitHub repository: `MaximCincinnatis/TORUS`
   - Vercel will auto-detect it's a React app

2. **Configure Build Settings**
   ```
   Framework Preset: Create React App
   Build Command: npm run build
   Output Directory: build
   Install Command: npm install
   ```

3. **Enable Auto-Deployment**
   - Vercel automatically deploys on every push to `master` branch
   - No additional configuration needed

4. **Environment Variables** (if needed)
   - Add any required env variables in Vercel dashboard
   - Settings → Environment Variables

### Manual Deployment Check

1. Visit [Vercel Dashboard](https://vercel.com/dashboard)
2. Check deployment status after pushing
3. View deployment logs if needed

## Update Schedule

### Manual Updates
Run whenever data needs refreshing:
```bash
node auto-update.js
```

### Automated Updates (Optional)
Set up a cron job for regular updates:

```bash
# Edit crontab
crontab -e

# Add this line for hourly updates
0 * * * * cd /path/to/torus-dashboard && node auto-update.js >> update.log 2>&1

# Or for every 6 hours
0 */6 * * * cd /path/to/torus-dashboard && node auto-update.js >> update.log 2>&1
```

## Monitoring

### Check Update Status
```bash
# View recent commits
git log --oneline -5

# Check Vercel deployment
# Visit: https://vercel.com/[your-username]/torus
```

### Troubleshooting

**If update fails:**
1. Check RPC endpoints are working
2. Ensure git credentials are set up
3. Verify GitHub push permissions
4. Check Vercel deployment logs

**If Vercel doesn't auto-deploy:**
1. Check GitHub integration in Vercel settings
2. Ensure pushing to correct branch (master)
3. Check Vercel deployment settings

## Data Update Details

The update process refreshes:
- ✅ All stake/create events and costs
- ✅ LP positions with accurate calculations
- ✅ Token prices and pool ratios
- ✅ Reward pool data
- ✅ Historical chart data
- ✅ Protocol day and totals

## Best Practices

1. **Run updates during low-traffic periods** to avoid RPC rate limits
2. **Monitor the first few automated deployments** to ensure everything works
3. **Keep backups** - the script automatically creates JSON backups
4. **Check deployment status** after major updates