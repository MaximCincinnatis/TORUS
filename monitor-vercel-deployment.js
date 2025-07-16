const fetch = require('node-fetch');

async function monitorVercelDeployment() {
  console.log('🔍 Monitoring Vercel deployment status...\n');
  
  const startTime = Date.now();
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const checkInterval = 10 * 1000; // 10 seconds
  
  // Get the latest commit hash
  const { execSync } = require('child_process');
  const latestCommit = execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
  console.log(`Latest commit: ${latestCommit}`);
  
  let deploymentComplete = false;
  let attempts = 0;
  
  while (!deploymentComplete && (Date.now() - startTime) < maxWaitTime) {
    attempts++;
    console.log(`\n[Attempt ${attempts}] Checking deployment status...`);
    
    try {
      // Check the deployment URL
      const response = await fetch('https://torus-dashboard-omega.vercel.app/api/data');
      
      if (response.ok) {
        const data = await response.json();
        const deploymentTime = data.metadata?.lastUpdate;
        
        if (deploymentTime) {
          const deploymentDate = new Date(deploymentTime);
          const currentDate = new Date();
          const timeDiff = currentDate - deploymentDate;
          
          console.log(`  Deployment timestamp: ${deploymentTime}`);
          console.log(`  Time since deployment: ${Math.round(timeDiff / 1000)}s`);
          
          // If the deployment is very recent (within last 2 minutes), consider it complete
          if (timeDiff < 2 * 60 * 1000) {
            deploymentComplete = true;
            console.log('✅ Deployment appears to be recent and complete!');
          }
        }
      }
      
      // Also check the main site
      const mainResponse = await fetch('https://torus-dashboard-omega.vercel.app/');
      console.log(`  Main site status: ${mainResponse.status}`);
      
    } catch (error) {
      console.error('  Error checking deployment:', error.message);
    }
    
    if (!deploymentComplete) {
      console.log(`  Waiting ${checkInterval / 1000}s before next check...`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  if (!deploymentComplete) {
    console.log('\n⚠️  Deployment monitoring timed out. Please check Vercel dashboard manually.');
  }
  
  // Final deployment test
  console.log('\n📊 Final deployment test:');
  try {
    const finalResponse = await fetch('https://torus-dashboard-omega.vercel.app/data/cached-data.json');
    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      console.log(`  LP Positions: ${finalData.lpPositions?.length || 0}`);
      console.log(`  Last update: ${finalData.metadata?.lastUpdate || 'Not found'}`);
      
      // Check GitHub for comparison
      const githubResponse = await fetch('https://raw.githubusercontent.com/MaximCincinnatis/TORUS/master/public/data/cached-data.json');
      if (githubResponse.ok) {
        const githubData = await githubResponse.json();
        const vercelUpdate = finalData.metadata?.lastUpdate;
        const githubUpdate = githubData.metadata?.lastUpdate;
        
        if (vercelUpdate === githubUpdate) {
          console.log('✅ Vercel data matches GitHub data!');
        } else {
          console.log('⚠️  Vercel data differs from GitHub:');
          console.log(`  Vercel: ${vercelUpdate}`);
          console.log(`  GitHub: ${githubUpdate}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in final test:', error.message);
  }
  
  console.log('\n🔗 Check deployment at: https://torus-dashboard-omega.vercel.app/');
  console.log('🔗 Vercel dashboard: https://vercel.com/maximcincinnatis-projects/torus-dashboard');
}

// Handle ES modules
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

monitorVercelDeployment();