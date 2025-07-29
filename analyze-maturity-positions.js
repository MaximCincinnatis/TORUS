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

// Analyze stake positions (includes both stakes and creates)
if (data.stakingData && data.stakingData.stakeEvents) {
    data.stakingData.stakeEvents.forEach(stake => {
        if (stake.maturityDate) {
            const maturityDateStr = stake.maturityDate.split('T')[0];
            
            for (const [day, dateStr] of Object.entries(targetDates)) {
                if (maturityDateStr === dateStr) {
                    // Check if this is a create position
                    if (stake.isCreate === true || stake.createDays !== undefined || stake.titanAmount !== undefined || stake.ethAmount !== undefined) {
                        const ethAmount = BigInt(stake.ethAmount || '0');
                        results[day].creates.push({
                            id: stake.id,
                            user: stake.user,
                            principal: stake.ethAmount || '0',
                            principalEth: Number(ethAmount) / 1e18,
                            maturityDate: stake.maturityDate,
                            protocolDay: stake.protocolDay || 'N/A',
                            createDays: stake.createDays,
                            titanAmount: stake.titanAmount || '0',
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
                            protocolDay: stake.protocolDay || 'N/A'
                        });
                        results[day].stakesTotal += Number(principal) / 1e18;
                    }
                }
            }
        }
    });
}

// createData section is not used in this JSON structure - creates are in stakeEvents

// Print results
console.log('=== POSITIONS MATURING ON PROTOCOL DAYS 17-19 ===\n');

for (const [day, dateStr] of Object.entries(targetDates)) {
    console.log(`\n--- Protocol Day ${day} (${dateStr}) ---`);
    
    console.log(`\nStake Positions: ${results[day].stakes.length}`);
    console.log(`Total Stakes Principal: ${results[day].stakesTotal.toFixed(6)} ETH`);
    
    if (results[day].stakes.length > 0) {
        console.log('Sample stakes:');
        results[day].stakes.slice(0, 3).forEach(stake => {
            console.log(`  ID: ${stake.id}, User: ${stake.user}, Principal: ${stake.principalEth.toFixed(6)} ETH`);
        });
        if (results[day].stakes.length > 3) {
            console.log(`  ... and ${results[day].stakes.length - 3} more`);
        }
    }
    
    console.log(`\nCreate Positions: ${results[day].creates.length}`);
    console.log(`Total Creates Principal: ${results[day].createsTotal.toFixed(6)} ETH`);
    
    if (results[day].creates.length > 0) {
        console.log('Sample creates:');
        results[day].creates.slice(0, 3).forEach(create => {
            console.log(`  ID: ${create.id}, User: ${create.user}`);
            console.log(`    ETH: ${create.principalEth.toFixed(6)}, TitanX Cost: ${create.costTitanX}`);
        });
        if (results[day].creates.length > 3) {
            console.log(`  ... and ${results[day].creates.length - 3} more`);
        }
    }
    
    console.log(`\nDay ${day} Totals:`);
    console.log(`  Total Positions: ${results[day].stakes.length + results[day].creates.length}`);
    console.log(`  Total Principal: ${(results[day].stakesTotal + results[day].createsTotal).toFixed(6)} ETH`);
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
    
    console.log(`Day ${day}: ${dayPositions} positions, ${dayPrincipal.toFixed(6)} ETH`);
}

console.log(`\nGrand Total: ${grandTotalPositions} positions, ${grandTotalPrincipal.toFixed(6)} ETH`);