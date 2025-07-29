const fs = require('fs');

// Read the cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Define target dates
const targetDates = {
    17: '2025-07-26',
    18: '2025-07-27', 
    19: '2025-07-28'
};

// Initialize results
const results = {
    17: { stakes: [], creates: [], stakesTotal: 0, createsTotal: 0 },
    18: { stakes: [], creates: [], stakesTotal: 0, createsTotal: 0 },
    19: { stakes: [], creates: [], stakesTotal: 0, createsTotal: 0 }
};

// Analyze all stake events
if (data.stakingData && data.stakingData.stakeEvents) {
    console.log(`Total stake events to analyze: ${data.stakingData.stakeEvents.length}`);
    
    let createCount = 0;
    let stakeCount = 0;
    
    data.stakingData.stakeEvents.forEach((stake, index) => {
        // Check if this entry has createDays field
        const hasCreateDays = 'createDays' in stake;
        
        if (hasCreateDays) {
            createCount++;
        } else {
            stakeCount++;
        }
        
        if (stake.maturityDate) {
            const maturityDateStr = stake.maturityDate.split('T')[0];
            
            for (const [day, dateStr] of Object.entries(targetDates)) {
                if (maturityDateStr === dateStr) {
                    if (hasCreateDays) {
                        // This is a create position
                        const ethAmount = BigInt(stake.ethAmount || '0');
                        const titanAmount = BigInt(stake.titanAmount || '0');
                        const torusAmount = BigInt(stake.principal || stake.torusAmount || '0');
                        
                        results[day].creates.push({
                            id: stake.id || stake.createId,
                            user: stake.user,
                            ethAmount: stake.ethAmount || '0',
                            ethAmountDecimal: Number(ethAmount) / 1e18,
                            titanAmount: stake.titanAmount || '0',
                            titanAmountDecimal: Number(titanAmount) / 1e18,
                            torusAmount: stake.principal || stake.torusAmount || '0',
                            torusAmountDecimal: Number(torusAmount) / 1e18,
                            maturityDate: stake.maturityDate,
                            createDays: stake.createDays,
                            costETH: stake.costETH || '0',
                            costTitanX: stake.costTitanX || '0'
                        });
                        results[day].createsTotal += Number(ethAmount) / 1e18;
                    } else {
                        // Regular stake
                        const principal = BigInt(stake.principal || '0');
                        results[day].stakes.push({
                            id: stake.id,
                            user: stake.user,
                            principal: stake.principal,
                            principalEth: Number(principal) / 1e18,
                            maturityDate: stake.maturityDate,
                            stakingDays: stake.stakingDays || stake.duration
                        });
                        results[day].stakesTotal += Number(principal) / 1e18;
                    }
                }
            }
        }
    });
    
    console.log(`\nFound ${createCount} creates and ${stakeCount} regular stakes`);
}

// Print results
console.log('\n=== POSITIONS MATURING ON PROTOCOL DAYS 17-19 ===\n');

for (const [day, dateStr] of Object.entries(targetDates)) {
    console.log(`\n--- Protocol Day ${day} (${dateStr}) ---`);
    
    console.log(`\nStake Positions: ${results[day].stakes.length}`);
    console.log(`Total Stakes Principal: ${results[day].stakesTotal.toFixed(6)} ETH`);
    
    if (results[day].stakes.length > 0) {
        console.log('Stakes:');
        results[day].stakes.forEach(stake => {
            console.log(`  ID: ${stake.id}, User: ${stake.user}`);
            console.log(`    Principal: ${stake.principalEth.toFixed(6)} ETH, Days: ${stake.stakingDays}`);
        });
    }
    
    console.log(`\nCreate Positions: ${results[day].creates.length}`);
    console.log(`Total Creates ETH Principal: ${results[day].createsTotal.toFixed(6)} ETH`);
    
    if (results[day].creates.length > 0) {
        console.log('Creates:');
        results[day].creates.forEach(create => {
            console.log(`  ID: ${create.id}, User: ${create.user}`);
            console.log(`    Create Days: ${create.createDays}`);
            console.log(`    ETH: ${create.ethAmountDecimal.toFixed(6)}, TitanX: ${create.titanAmountDecimal.toFixed(2)}`);
            console.log(`    Torus Minted: ${create.torusAmountDecimal.toFixed(6)}`);
        });
    }
    
    console.log(`\nDay ${day} Totals:`);
    console.log(`  Total Positions: ${results[day].stakes.length + results[day].creates.length}`);
    console.log(`  Total ETH Principal: ${(results[day].stakesTotal + results[day].createsTotal).toFixed(6)} ETH`);
}

// Summary
console.log('\n\n=== SUMMARY ===');
let grandTotalPositions = 0;
let grandTotalPrincipal = 0;

for (const day of Object.keys(results)) {
    const dayPositions = results[day].stakes.length + results[day].creates.length;
    const dayPrincipal = results[day].stakesTotal + results[day].createsTotal;
    grandTotalPositions += dayPositions;
    grandTotalPrincipal += dayPrincipal;
    
    console.log(`Day ${day}: ${dayPositions} positions, ${dayPrincipal.toFixed(6)} ETH principal`);
}

console.log(`\nGrand Total: ${grandTotalPositions} positions, ${grandTotalPrincipal.toFixed(6)} ETH principal`);