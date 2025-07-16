# Vercel + Private GitHub Repository Issues & Solutions

## The Problem
Your private GitHub repository may be causing Vercel deployment failures because:

### 1. **GitHub Raw URLs Don't Work with Private Repos**
Our Edge Function tries to fetch from:
```
https://raw.githubusercontent.com/MaximCincinnatis/TORUS/master/public/data/cached-data.json
```
This returns 404 for private repos without authentication.

### 2. **Vercel's GitHub App Permissions**
Even if connected, Vercel's GitHub app might not have:
- Read access to repository contents
- Webhook permissions for push events
- Access to the specific branch (master)

## Solutions

### Option 1: Fix Vercel GitHub Integration (Recommended)
1. Go to Vercel Dashboard → Settings → Git
2. Check if your repo shows as connected
3. Click "Manage Access" or reconnect GitHub
4. Ensure Vercel has these permissions:
   - Repository access: Read
   - Webhooks: Read & Write
   - Contents: Read

### Option 2: Make Repository Public
- Simplest solution if data isn't sensitive
- All GitHub raw URLs will work immediately
- No authentication needed

### Option 3: Use GitHub Personal Access Token
For the Edge Function to work with private repo:

1. Create a GitHub Personal Access Token:
   - Go to GitHub → Settings → Developer Settings → Personal Access Tokens
   - Generate token with `repo` scope

2. Update the Edge Function:
```javascript
const response = await fetch(
  'https://api.github.com/repos/MaximCincinnatis/TORUS/contents/public/data/cached-data.json',
  {
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3.raw'
    }
  }
);
```

3. Add token to Vercel Environment Variables:
   - Vercel Dashboard → Settings → Environment Variables
   - Add `GITHUB_TOKEN` with your token value

### Option 4: Trigger Manual Deployments
If auto-deploy won't work:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy manually
vercel --prod
```

## Quick Test
To verify if private repo is the issue:
1. Temporarily make repo public
2. Push a small change
3. Check if Vercel auto-deploys
4. If it works, privacy was the issue

## Recommended Fix
1. Check Vercel dashboard deployment logs first
2. Re-authorize GitHub integration with full permissions
3. If still failing, implement Option 3 (GitHub token)
4. As last resort, consider making repo public