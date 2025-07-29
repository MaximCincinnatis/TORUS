const fs = require('fs');

// Read the cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Define target dates
const targetDates = {
    17: '2025-07-26',
    18: '2025-07-27', 
    19: '2025-07-28'
};

let totalCreateCount = 0;
let totalStakeCount = 0;
let foundTargetDates = [];

// Check all stake events
if (data.stakingData && data.stakingData.stakeEvents) {
    data.stakingData.stakeEvents.forEach(stake => {
        // Check if it's a create based on multiple indicators
        // Note: Creates can have principal field too (representing Torus amount)
        const isCreate = stake.isCreate === true || 
                        stake.createDays !== undefined || 
                        stake.createId !== undefined;
        
        if (isCreate) {
            totalCreateCount++;
            
            // Check if it matures on our target dates
            if (stake.maturityDate) {
                const maturityDateStr = stake.maturityDate.split('T')[0];
                
                for (const [day, dateStr] of Object.entries(targetDates)) {
                    if (maturityDateStr === dateStr) {
                        foundTargetDates.push({
                            type: 'CREATE',
                            day: day,
                            date: maturityDateStr,
                            fullDate: stake.maturityDate,
                            user: stake.user,
                            id: stake.id || stake.createId,
                            createDays: stake.createDays,
                            titanAmount: stake.titanAmount,
                            ethAmount: stake.ethAmount,
                            costETH: stake.costETH,
                            costTitanX: stake.costTitanX,
                            principal: stake.principal
                        });
                    }
                }
            }
        } else {
            totalStakeCount++;
            
            // Check if it matures on our target dates
            if (stake.maturityDate) {
                const maturityDateStr = stake.maturityDate.split('T')[0];
                
                for (const [day, dateStr] of Object.entries(targetDates)) {
                    if (maturityDateStr === dateStr) {
                        foundTargetDates.push({
                            type: 'STAKE',
                            day: day,
                            date: maturityDateStr,
                            fullDate: stake.maturityDate,
                            user: stake.user,
                            id: stake.id,
                            principal: stake.principal,
                            stakingDays: stake.stakingDays || stake.duration
                        });
                    }
                }
            }
        }
    });
}

console.log('=== ANALYSIS OF ALL POSITIONS ===\n');
console.log(`Total Stake Events in Data: ${data.stakingData?.stakeEvents?.length || 0}`);
console.log(`Total Regular Stakes: ${totalStakeCount}`);
console.log(`Total Creates: ${totalCreateCount}`);

console.log('\n=== POSITIONS MATURING ON DAYS 17-19 ===\n');

// Group by day
const byDay = {
    17: foundTargetDates.filter(p => p.day === '17'),
    18: foundTargetDates.filter(p => p.day === '18'),
    19: foundTargetDates.filter(p => p.day === '19')
};

for (const [day, positions] of Object.entries(byDay)) {
    console.log(`\n--- Day ${day} (${targetDates[day]}) ---`);
    console.log(`Total Positions: ${positions.length}`);
    
    const stakes = positions.filter(p => p.type === 'STAKE');
    const creates = positions.filter(p => p.type === 'CREATE');
    
    console.log(`Stakes: ${stakes.length}`);
    console.log(`Creates: ${creates.length}`);
    
    if (positions.length > 0) {
        console.log('\nDetails:');
        positions.forEach(pos => {
            console.log(`\n${pos.type}:`);
            console.log(`  User: ${pos.user}`);
            console.log(`  ID: ${pos.id}`);
            console.log(`  Maturity: ${pos.fullDate}`);
            
            if (pos.type === 'STAKE') {
                const principalEth = pos.principal ? (BigInt(pos.principal) / BigInt(1e18)).toString() : '0';
                console.log(`  Principal: ${principalEth} ETH`);
                console.log(`  Staking Days: ${pos.stakingDays}`);
            } else {
                console.log(`  Create Days: ${pos.createDays}`);
                console.log(`  ETH Amount: ${pos.ethAmount || '0'}`);
                console.log(`  TitanX Amount: ${pos.titanAmount || '0'}`);
                console.log(`  Cost ETH: ${pos.costETH || '0'}`);
                console.log(`  Cost TitanX: ${pos.costTitanX || '0'}`);
            }
        });
    }
}