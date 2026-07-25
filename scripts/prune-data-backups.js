#!/usr/bin/env node
/**
 * Prune routine TORUS data snapshots.
 *
 * WHY (2026-07-25): public/data/backups/ had grown to 77,306 files / ~138GB spanning
 * 2025-07-16 -> 2026-07-25 — a ~3MB snapshot every ~5 minutes for over a year, with no
 * cleanup anywhere. Plus ~730 loose cached-data.backup-<epoch>.json in public/data/.
 * (Cleanup code for the loose ones exists in update-creates-stakes-incremental.js:621
 * "keep last 5", but the cron runs auto-update-fixed.js, so it never executes.)
 *
 * WHAT IS DELIBERATELY *NOT* TOUCHED — this script is conservative on purpose:
 *   1. PINNED — filenames hardcoded by scripts. restore-missing-position.js:18 reads
 *      backups/cached-data-2025-07-15T23-38-41.061Z.json by name; deleting it would break
 *      a real recovery tool. Verified by grepping every hardcoded backups/*.json reference.
 *   2. Anything containing "before" — cached-data-before-stake-refresh-*, -before-position-
 *      restore-*, -before-missing-days-*, buy-process-data-before-fix/rebuild. These are
 *      deliberate PRE-REPAIR snapshots taken by humans fixing something. They are far more
 *      valuable than routine 5-minute ones and are kept forever regardless of age.
 *   3. Anything newer than RETENTION_DAYS.
 * Only routine `cached-data-<ISO>.json` snapshots older than the window are removed.
 *
 * The chart history itself does NOT live here — it is cumulative inside cached-data.json
 * (verified: cacheDataLoader.ts reads only /data/cached-data.json). git additionally holds
 * 51,581 committed versions of that file back to 2025-07-14. These snapshots are a finer-
 * grained undo than git, which is why a window is kept rather than deleting everything.
 *
 * Usage: node scripts/prune-data-backups.js [--dry-run] [--days N]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'public/data/backups');
const LOOSE_DIR = path.join(ROOT, 'public/data');

const RETENTION_DAYS = (() => {
  const i = process.argv.indexOf('--days');
  if (i !== -1 && process.argv[i + 1]) return parseInt(process.argv[i + 1], 10);
  return parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
})();
const KEEP_LOOSE = parseInt(process.env.KEEP_LOOSE_BACKUPS || '5', 10);
const DRY = process.argv.includes('--dry-run');

// Rule 1: hardcoded by scripts — never delete. Keep in sync with:
//   grep -rhoE "backups/[A-Za-z0-9._:-]+\.json" --include='*.js' --include='*.ts'
const PINNED = new Set([
  'cached-data-2025-07-15T23-38-41.061Z.json', // restore-missing-position.js:18
  'buy-process-data-before-fix.json',
  'buy-process-data-before-rebuild.json',
]);

// Rule 3: only routine timestamped snapshots are ever candidates.
const ROUTINE_RE = /^cached-data-(\d{4})-(\d{2})-(\d{2})T[\d._-]+Z\.json$/;
const LOOSE_RE = /^cached-data\.backup-(\d+)\.json$/;

function human(bytes) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)}${u[i]}`;
}

function pruneRoutine() {
  if (!fs.existsSync(BACKUP_DIR)) return { scanned: 0, removed: 0, freed: 0, kept: 0, protectedCount: 0 };
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  let scanned = 0, removed = 0, freed = 0, kept = 0, protectedCount = 0;

  for (const name of fs.readdirSync(BACKUP_DIR)) {
    scanned++;
    if (PINNED.has(name) || name.includes('before')) { protectedCount++; continue; }
    const m = ROUTINE_RE.exec(name);
    if (!m) { protectedCount++; continue; }          // unknown shape -> leave alone
    const stamp = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (!Number.isFinite(stamp) || stamp >= cutoff) { kept++; continue; }

    const full = path.join(BACKUP_DIR, name);
    try {
      const sz = fs.statSync(full).size;
      if (!DRY) fs.unlinkSync(full);
      removed++; freed += sz;
    } catch { /* raced with another writer — fine */ }
  }
  return { scanned, removed, freed, kept, protectedCount };
}

function pruneLoose() {
  if (!fs.existsSync(LOOSE_DIR)) return { removed: 0, freed: 0, kept: 0 };
  const files = fs.readdirSync(LOOSE_DIR)
    .filter((f) => LOOSE_RE.test(f))
    .sort((a, b) => Number(LOOSE_RE.exec(b)[1]) - Number(LOOSE_RE.exec(a)[1])); // newest first
  const doomed = files.slice(KEEP_LOOSE);
  let removed = 0, freed = 0;
  for (const f of doomed) {
    const full = path.join(LOOSE_DIR, f);
    try {
      const sz = fs.statSync(full).size;
      if (!DRY) fs.unlinkSync(full);
      removed++; freed += sz;
    } catch { /* ignore */ }
  }
  return { removed, freed, kept: Math.min(files.length, KEEP_LOOSE) };
}

if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS < 1) {
  console.error(`Refusing to run with --days=${RETENTION_DAYS}; must be >= 1.`);
  process.exit(1);
}

console.log(`${DRY ? '[DRY RUN] ' : ''}Pruning TORUS data snapshots (retention ${RETENTION_DAYS} days, keep ${KEEP_LOOSE} loose)`);
const r = pruneRoutine();
console.log(`  backups/      scanned=${r.scanned} removed=${r.removed} kept_in_window=${r.kept} protected=${r.protectedCount} freed=${human(r.freed)}`);
const l = pruneLoose();
console.log(`  public/data/  loose removed=${l.removed} kept=${l.kept} freed=${human(l.freed)}`);
console.log(`${DRY ? '[DRY RUN] would free' : 'Freed'} ${human(r.freed + l.freed)} total.`);
