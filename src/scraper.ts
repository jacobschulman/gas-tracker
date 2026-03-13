import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { FuelPrices, NationalSnapshot, StateSnapshot, STATE_CODES } from './types';

const BASE_URL = 'https://gasprices.aaa.com';
const CRAWL_DELAY_MS = 10_000; // respect robots.txt
const USER_AGENT = 'GasTracker/1.0 (https://github.com/jacobschulman/gas-tracker)';

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function estimateDate(source: string, today: Date): string {
  const d = new Date(today);
  switch (source) {
    case 'current':
      break;
    case 'yesterday':
      d.setDate(d.getDate() - 1);
      break;
    case 'week_ago':
      d.setDate(d.getDate() - 7);
      break;
    case 'month_ago':
      d.setMonth(d.getMonth() - 1);
      break;
    case 'year_ago':
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d.toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

const SOURCE_MAP: Record<string, string> = {
  'Current Avg.': 'current',
  'Current': 'current',
  'Yesterday Avg.': 'yesterday',
  'Yesterday': 'yesterday',
  'Week Ago Avg.': 'week_ago',
  'Week Ago': 'week_ago',
  'Month Ago Avg.': 'month_ago',
  'Month Ago': 'month_ago',
  'Year Ago Avg.': 'year_ago',
  'Year Ago': 'year_ago',
};

export async function scrapeNational(): Promise<NationalSnapshot[]> {
  console.log('Scraping national averages...');
  const html = await fetchPage(BASE_URL);
  const $ = cheerio.load(html);
  const today = new Date();
  const scrapedAt = today.toISOString();
  const snapshots: NationalSnapshot[] = [];

  // Find the main prices table - look for table with fuel grade headers
  $('table').each((_, table) => {
    const headers: string[] = [];
    $(table).find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim());
    });

    // Check if this looks like a price table
    const hasRegular = headers.some(h => /regular/i.test(h));
    const hasDiesel = headers.some(h => /diesel/i.test(h));
    if (!hasRegular || !hasDiesel) return;

    // Find column indices
    const regularIdx = headers.findIndex(h => /regular/i.test(h));
    const midIdx = headers.findIndex(h => /mid/i.test(h));
    const premiumIdx = headers.findIndex(h => /premium/i.test(h));
    const dieselIdx = headers.findIndex(h => /diesel/i.test(h));
    const e85Idx = headers.findIndex(h => /e85/i.test(h));

    $(table).find('tbody tr').each((_, row) => {
      const cells: string[] = [];
      $(row).find('td').each((_, td) => {
        cells.push($(td).text().trim());
      });
      if (cells.length < 2) return;

      const label = cells[0];
      const sourceKey = SOURCE_MAP[label];
      if (!sourceKey) return;

      const prices: FuelPrices = {
        regular: regularIdx >= 0 ? parsePrice(cells[regularIdx]) : null,
        midGrade: midIdx >= 0 ? parsePrice(cells[midIdx]) : null,
        premium: premiumIdx >= 0 ? parsePrice(cells[premiumIdx]) : null,
        diesel: dieselIdx >= 0 ? parsePrice(cells[dieselIdx]) : null,
        e85: e85Idx >= 0 ? parsePrice(cells[e85Idx]) : null,
      };

      snapshots.push({
        date: estimateDate(sourceKey, today),
        prices,
        source: sourceKey as NationalSnapshot['source'],
        scrapedAt,
      });
    });
  });

  console.log(`  Found ${snapshots.length} national data points`);
  return snapshots;
}

export async function scrapeStatesSummary(): Promise<StateSnapshot[]> {
  console.log('Scraping state summary...');
  const html = await fetchPage(`${BASE_URL}/state-gas-price-averages/`);
  const $ = cheerio.load(html);
  const today = new Date();
  const scrapedAt = today.toISOString();
  const snapshots: StateSnapshot[] = [];

  $('table').each((_, table) => {
    const headers: string[] = [];
    $(table).find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim());
    });

    const hasRegular = headers.some(h => /regular/i.test(h));
    if (!hasRegular) return;

    const regularIdx = headers.findIndex(h => /regular/i.test(h));
    const midIdx = headers.findIndex(h => /mid/i.test(h));
    const premiumIdx = headers.findIndex(h => /premium/i.test(h));
    const dieselIdx = headers.findIndex(h => /diesel/i.test(h));

    $(table).find('tbody tr').each((_, row) => {
      const cells: string[] = [];
      $(row).find('td').each((_, td) => {
        cells.push($(td).text().trim());
      });
      if (cells.length < 2) return;

      const stateName = cells[0].trim();
      const stateCode = STATE_CODES[stateName];
      if (!stateCode) return;

      const prices: FuelPrices = {
        regular: regularIdx >= 0 ? parsePrice(cells[regularIdx]) : null,
        midGrade: midIdx >= 0 ? parsePrice(cells[midIdx]) : null,
        premium: premiumIdx >= 0 ? parsePrice(cells[premiumIdx]) : null,
        diesel: dieselIdx >= 0 ? parsePrice(cells[dieselIdx]) : null,
      };

      snapshots.push({
        date: today.toISOString().split('T')[0],
        state: stateCode,
        stateName,
        prices,
        source: 'current',
        scrapedAt,
      });
    });
  });

  console.log(`  Found ${snapshots.length} state current prices`);
  return snapshots;
}

export async function scrapeStateDetail(stateCode: string, stateName: string): Promise<StateSnapshot[]> {
  const html = await fetchPage(`${BASE_URL}/?state=${stateCode}`);
  const $ = cheerio.load(html);
  const today = new Date();
  const scrapedAt = today.toISOString();
  const snapshots: StateSnapshot[] = [];

  // Find the state averages table (first table with time period rows)
  $('table').each((_, table) => {
    const headers: string[] = [];
    $(table).find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim());
    });

    const hasRegular = headers.some(h => /regular/i.test(h));
    const hasDiesel = headers.some(h => /diesel/i.test(h));
    if (!hasRegular || !hasDiesel) return;

    const regularIdx = headers.findIndex(h => /regular/i.test(h));
    const midIdx = headers.findIndex(h => /mid/i.test(h));
    const premiumIdx = headers.findIndex(h => /premium/i.test(h));
    const dieselIdx = headers.findIndex(h => /diesel/i.test(h));

    $(table).find('tbody tr').each((_, row) => {
      const cells: string[] = [];
      $(row).find('td').each((_, td) => {
        cells.push($(td).text().trim());
      });
      if (cells.length < 2) return;

      const label = cells[0];
      const sourceKey = SOURCE_MAP[label];
      if (!sourceKey) return;

      const prices: FuelPrices = {
        regular: regularIdx >= 0 ? parsePrice(cells[regularIdx]) : null,
        midGrade: midIdx >= 0 ? parsePrice(cells[midIdx]) : null,
        premium: premiumIdx >= 0 ? parsePrice(cells[premiumIdx]) : null,
        diesel: dieselIdx >= 0 ? parsePrice(cells[dieselIdx]) : null,
      };

      snapshots.push({
        date: estimateDate(sourceKey, today),
        state: stateCode,
        stateName,
        prices,
        source: sourceKey as StateSnapshot['source'],
        scrapedAt,
      });
    });

    // Only process the first matching table (state averages, not metro)
    return false;
  });

  return snapshots;
}

export async function scrapeAllStateDetails(): Promise<StateSnapshot[]> {
  const allSnapshots: StateSnapshot[] = [];
  const entries = Object.entries(STATE_CODES);

  for (let i = 0; i < entries.length; i++) {
    const [stateName, stateCode] = entries[i];
    console.log(`  Scraping ${stateName} (${stateCode}) [${i + 1}/${entries.length}]...`);
    try {
      const snapshots = await scrapeStateDetail(stateCode, stateName);
      allSnapshots.push(...snapshots);
    } catch (err) {
      console.error(`  Failed to scrape ${stateName}: ${err}`);
    }
    // Respect crawl delay
    if (i < entries.length - 1) {
      await sleep(CRAWL_DELAY_MS);
    }
  }

  console.log(`  Found ${allSnapshots.length} total state historical data points`);
  return allSnapshots;
}
