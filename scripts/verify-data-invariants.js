#!/usr/bin/env node
/**
 * Data-truncation guard for the TORUS dashboard.
 *
 * WHY THIS EXISTS (2026-07-25)
 * The dashboard's entire chart history is CUMULATIVE inside public/data/*.json — 469 reward-pool
 * days, ~4,000 stake/create events, 381 buy-process days — appended over time since 2025-07-10.
 * The earliest days predate every snapshot and every git commit of the file, so they survive only
 * because each update carries them forward. A write that silently drops records therefore destroys
 * chart history permanently, and nothing would surface it until someone noticed a chart looked wrong.
 *
 * WHAT IT DOES
 * Compares the working-tree data files against the LAST COMMITTED version (git show HEAD:<path>)
 * and refuses to proceed if an append-only series shrank. Comparing against git rather than a
 * stored high-water mark means there is no side file to drift, and the comparison is exactly the
 * question that matters: "is what I am about to commit worse than what is already committed?"
 *
 * APPEND_ONLY vs MONITORED
 *   APPEND_ONLY — derived from on-chain events; can only ever grow. Any decrease is a hard FAIL.
 *   MONITORED   — forward-looking projections/schedules that can legitimately re-shape as days
 *                 roll off. A decrease only WARNS, so this guard never blocks a valid update.
 *
 * Exit 0 = safe to proceed. Exit 1 = truncation detected, caller must abort (fail fast).
 * Usage: node scripts/verify-data-invariants.js [--verbose]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

// path-in-json -> how strictly we treat a decrease
const CHECKS = [
  { file: 'public/data/cached-data.json',       key: 'stakingData.createEvents',        mode: 'APPEND_ONLY' },
  { file: 'public/data/cached-data.json',       key: 'stakingData.stakeEvents',         mode: 'APPEND_ONLY' },
  { file: 'public/data/cached-data.json',       key: 'stakingData.rewardPoolData',      mode: 'MONITORED'   },
  { file: 'public/data/cached-data.json',       key: 'chartData.futureSupplyProjection', mode: 'MONITORED'  },
  { file: 'public/data/cached-data.json',       key: 'lpPositions',                     mode: 'MONITORED'   },
  { file: 'public/data/buy-process-data.json',  key: 'dailyData',                       mode: 'APPEND_ONLY' },
  { file: 'public/data/buy-process-burns.json', key: 'feeDrivenBurns',                  mode: 'APPEND_ONLY' },
];

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

function readWorking(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    return { __error: e.message };
  }
}

function readCommitted(rel) {
  try {
    const out = execSync(`git show HEAD:${rel}`, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
    return JSON.parse(out.toString('utf8'));
  } catch {
    return null; // not in HEAD yet (new file) — nothing to compare against
  }
}

const cache = {};
let failures = 0;
let warnings = 0;

console.log('Verifying data invariants (working tree vs last commit)...');

for (const { file, key, mode } of CHECKS) {
  if (!cache[file]) cache[file] = { cur: readWorking(file), prev: readCommitted(file) };
  const { cur, prev } = cache[file];

  if (cur && cur.__error) {
    console.error(`  FAIL  ${file} is unreadable/invalid JSON: ${cur.__error}`);
    failures++;
    continue;
  }

  const curArr = dig(cur, key);
  if (!Array.isArray(curArr)) {
    console.error(`  FAIL  ${file}:${key} is missing or not an array (got ${typeof curArr})`);
    failures++;
    continue;
  }

  if (prev === null) {
    if (VERBOSE) console.log(`  skip  ${file}:${key} — no committed version to compare`);
    continue;
  }

  const prevArr = dig(prev, key);
  const prevLen = Array.isArray(prevArr) ? prevArr.length : 0;
  const delta = curArr.length - prevLen;

  if (delta < 0) {
    if (mode === 'APPEND_ONLY') {
      console.error(`  FAIL  ${file}:${key} SHRANK ${prevLen} -> ${curArr.length} (${delta}) [append-only]`);
      failures++;
    } else {
      console.warn(`  WARN  ${file}:${key} shrank ${prevLen} -> ${curArr.length} (${delta}) [projection, allowed]`);
      warnings++;
    }
  } else if (VERBOSE || delta > 0) {
    console.log(`  ok    ${file}:${key} ${prevLen} -> ${curArr.length} (+${delta})`);
  }
}

if (failures > 0) {
  console.error(`\nABORT: ${failures} invariant failure(s). Refusing to publish truncated data.`);
  console.error('Inspect the update that produced this before committing. To recover a good copy:');
  console.error('  git show HEAD:public/data/cached-data.json > /tmp/good.json');
  process.exit(1);
}
console.log(`Invariants OK${warnings ? ` (${warnings} warning(s))` : ''}.`);
process.exit(0);
