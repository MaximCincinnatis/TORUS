const fs = require('fs');
const path = require('path');

console.log('=== SEARCHING FOR POSITION TO CREATE CONVERSION ===\n');

// Load the cached data to understand the duplicate structure
const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Look at the structure of duplicates
const createWithoutHash = data.stakingData.createEvents.filter(c => !c.transactionHash);
const createWithHash = data.stakingData.createEvents.filter(c => c.transactionHash);

console.log('Structure comparison:');
console.log('\nCreate WITH txHash fields:', Object.keys(createWithHash[0] || {}).sort().join(', '));
console.log('\nCreate WITHOUT txHash fields:', Object.keys(createWithoutHash[0] || {}).sort().join(', '));

// The creates without txHash have these extra fields that match position structure:
// owner, createId, principal, id, createDays, startDate, titanXAmount, ethAmount, power, claimedCreate, claimedStake

// These fields strongly suggest they come from getStakePositions() calls
// Let's search for where positions are being converted to creates

const { execSync } = require('child_process');

console.log('\n\nSearching for scripts that might convert positions to creates:');

// Search for files that process positions and might add them as creates
const searches = [
  'grep -r "positions\\.forEach.*{" scripts/ --include="*.js" | grep -v node_modules',
  'grep -r "position\\.principal" scripts/ --include="*.js" | grep -v node_modules | head -10',
  'grep -r "claimedCreate" scripts/ --include="*.js" | grep -v node_modules | head -10',
  'grep -r "createId.*=.*position" scripts/ --include="*.js" | grep -v node_modules',
  'grep -r "owner.*=.*position" scripts/ --include="*.js" | grep -v node_modules'
];

searches.forEach(search => {
  try {
    console.log(`\n$ ${search}`);
    const result = execSync(search, { encoding: 'utf8' });
    console.log(result || 'No results');
  } catch (e) {
    // No matches
  }
});

// Look specifically for where creates might be built from positions
console.log('\n\nSearching for create object construction from positions:');
try {
  const createConstruction = execSync('grep -r "user:.*owner:" scripts/ --include="*.js" | head -10', { encoding: 'utf8' });
  console.log(createConstruction);
} catch (e) {
  console.log('No direct construction found');
}