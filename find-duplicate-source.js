const fs = require('fs');
const { execSync } = require('child_process');

console.log('=== SEARCHING FOR DUPLICATE SOURCE ===\n');

// Search for files that might be adding creates from positions
const searchTerms = [
  'positions.*isCreate',
  'pos.isCreate',
  'position.isCreate',
  'createEvents.push.*position',
  'createEvents.push.*pos',
  'creates from.*position'
];

console.log('Searching for patterns that might create duplicates:\n');

searchTerms.forEach(term => {
  try {
    console.log(`\nSearching for: "${term}"`);
    const result = execSync(`grep -r "${term}" scripts/ --include="*.js" | head -5`, { encoding: 'utf8' });
    if (result) {
      console.log(result);
    }
  } catch (e) {
    // No matches
  }
});

// Also check for files that might merge or combine data
console.log('\n\nSearching for merge/combine operations:');
try {
  const mergeSearch = execSync('grep -r "concat\\|merge\\|combine" scripts/ --include="*.js" | grep -i "create" | head -10', { encoding: 'utf8' });
  console.log(mergeSearch);
} catch (e) {
  console.log('No merge operations found');
}

// Check for positions being transformed into creates
console.log('\n\nSearching for position to create transformations:');
try {
  const transformSearch = execSync('grep -r "positions\\.map\\|positions\\.filter\\|positions\\.forEach" scripts/ --include="*.js" | grep -B2 -A2 "create" | head -20', { encoding: 'utf8' });
  console.log(transformSearch);
} catch (e) {
  console.log('No transformations found');
}