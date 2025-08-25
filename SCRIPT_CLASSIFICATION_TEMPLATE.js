/**
 * ============================================================================
 * SCRIPT STATUS CLASSIFICATION SYSTEM
 * ============================================================================
 * 
 * Every script in the TORUS Dashboard should have one of these headers.
 * This helps identify which scripts are active, deprecated, or experimental.
 * 
 * CLASSIFICATION LEVELS:
 * ----------------------
 * 
 * 🟢 ACTIVE (Production)
 *    - Currently running in production
 *    - Called by cron jobs or other active scripts
 *    - DO NOT DELETE OR MODIFY WITHOUT TESTING
 * 
 * 🟡 UTILITY (On-demand)
 *    - Helper scripts run manually when needed
 *    - May be called during debugging or maintenance
 *    - Keep available but not automated
 * 
 * 🔴 DEPRECATED (To be removed)
 *    - No longer used in production
 *    - Replaced by newer scripts
 *    - Safe to archive after verification
 * 
 * 🔵 EXPERIMENTAL (Testing)
 *    - Development or testing scripts
 *    - Not for production use
 *    - May become active after testing
 * 
 * ============================================================================
 */

// EXAMPLE HEADER FOR ACTIVE SCRIPT:
/**
 * STATUS: 🟢 ACTIVE - Production Script
 * LAST MODIFIED: 2025-08-25
 * AUTHOR: [Author name]
 * 
 * PURPOSE:
 * Main automation script that orchestrates all data updates for the TORUS Dashboard.
 * Runs every 5 minutes via cron job.
 * 
 * CALLED BY:
 * - Cron job: */5 * * * * /home/wsl/projects/TORUSspecs/torus-dashboard/run-auto-update.sh
 * - Manual execution for testing
 * 
 * DEPENDENCIES:
 * - smart-update-fixed.js (incremental updates)
 * - update-lp-fee-burns.js (LP fee tracking)
 * - incremental-lp-updater.js (LP position updates)
 * - force-vercel-rebuild.js (deployment trigger)
 * 
 * OUTPUTS:
 * - Updates: public/data/cached-data.json
 * - Updates: public/data/buy-process-data.json
 * - Creates: update-log.json
 * - Git commit and push to trigger Vercel deployment
 * 
 * CRITICAL NOTES:
 * - DO NOT MODIFY without testing the full update cycle
 * - Fallback to full update if errors occur
 * - Preserves existing data through smart merging
 */

// EXAMPLE HEADER FOR DEPRECATED SCRIPT:
/**
 * STATUS: 🔴 DEPRECATED - Replaced by smart-update-fixed.js
 * LAST MODIFIED: 2025-07-15
 * DEPRECATED DATE: 2025-08-01
 * 
 * PURPOSE:
 * [Original] Initial version of smart update logic
 * 
 * REPLACED BY:
 * - smart-update-fixed.js (includes deduplication fixes)
 * 
 * MIGRATION NOTES:
 * - All functionality moved to smart-update-fixed.js
 * - Added proper duplicate handling
 * - Fixed data preservation issues
 * 
 * DO NOT USE - Will be archived after 2025-09-01
 */

// EXAMPLE HEADER FOR UTILITY SCRIPT:
/**
 * STATUS: 🟡 UTILITY - Manual Execution Only
 * LAST MODIFIED: 2025-08-20
 * 
 * PURPOSE:
 * Audits the current state of all LP positions and validates data integrity
 * 
 * USAGE:
 * node audit-lp-positions.js [--fix] [--verbose]
 * 
 * WHEN TO USE:
 * - After major updates to verify data integrity
 * - When investigating LP position discrepancies
 * - Before deploying new LP calculation logic
 * 
 * DEPENDENCIES:
 * - public/data/cached-data.json (reads)
 * - shared/lpCalculations.js
 * 
 * OUTPUTS:
 * - Console report of LP position status
 * - audit-lp-report.json (if issues found)
 */

// EXAMPLE HEADER FOR EXPERIMENTAL SCRIPT:
/**
 * STATUS: 🔵 EXPERIMENTAL - Not for Production
 * CREATED: 2025-08-24
 * AUTHOR: [Author name]
 * 
 * PURPOSE:
 * Testing new approach for fetching LP positions using Moralis API
 * 
 * TESTING STATUS:
 * - [ ] Basic functionality tested
 * - [ ] Rate limiting implemented
 * - [ ] Error handling complete
 * - [ ] Performance benchmarked
 * 
 * TODO BEFORE PRODUCTION:
 * 1. Add proper error handling
 * 2. Implement rate limiting
 * 3. Test with full dataset
 * 4. Compare results with existing method
 * 
 * NOTES:
 * - Requires MORALIS_API_KEY in .env
 * - May replace fetch-all-lp-positions.js if successful
 */