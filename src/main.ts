import { scrapeNational, scrapeStatesSummary, scrapeAllStateDetails } from './scraper';
import { loadDatabase, saveDatabase, upsertNational, upsertStates } from './database';
import { generateApi } from './api-generator';

async function main() {
  const args = process.argv.slice(2);
  const skipStateDetails = args.includes('--quick');
  const backfill = args.includes('--backfill');

  console.log('=== Gas Price Tracker ===');
  console.log(`Mode: ${backfill ? 'backfill (with historical columns)' : 'daily'}`);
  console.log(`State details: ${skipStateDetails ? 'skipped (quick mode)' : 'full scrape'}`);
  console.log('');

  const db = loadDatabase();

  // 1. National averages (includes yesterday, week ago, month ago, year ago)
  const nationalSnapshots = await scrapeNational();
  upsertNational(db, nationalSnapshots);

  // 2. State summary (current prices only, single request)
  const stateSummary = await scrapeStatesSummary();
  upsertStates(db, stateSummary);

  // 3. Individual state pages (historical columns per state)
  //    This takes ~8.5 minutes with 10s crawl delay for 51 states
  //    Use --quick to skip, or --backfill to include
  if (backfill || !skipStateDetails) {
    console.log('\nScraping individual state pages for historical data...');
    console.log('(This takes ~8.5 min to respect 10s crawl delay for 51 states)');
    const stateDetails = await scrapeAllStateDetails();
    upsertStates(db, stateDetails);
  }

  // 4. Save database
  saveDatabase(db);

  // 5. Generate static API files
  generateApi(db);

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
