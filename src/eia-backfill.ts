import fetch from 'node-fetch';
import { Database, FuelPrices } from './types';
import { loadDatabase, saveDatabase } from './database';
import { generateApi } from './api-generator';

const EIA_API_KEY = process.env.EIA_API_KEY;
if (!EIA_API_KEY) {
  console.error('Error: EIA_API_KEY environment variable is required');
  console.error('Get a free key at https://www.eia.gov/opendata/');
  process.exit(1);
}

const BASE_URL = 'https://api.eia.gov/v2/petroleum/pri/gnd/data/';

// EIA product codes → our grade names
const GRADE_MAP: Record<string, keyof FuelPrices> = {
  'EPMR': 'regular',
  'EPMM': 'midGrade',
  'EPMP': 'premium',
  'EPD2D': 'diesel',
};

// EIA duoarea codes → our state codes
// EIA only has 9 states + national
const AREA_MAP: Record<string, string> = {
  'NUS': 'NATIONAL',
  'SCA': 'CA',
  'SCO': 'CO',
  'SFL': 'FL',
  'SMA': 'MA',
  'SMN': 'MN',
  'SNY': 'NY',
  'SOH': 'OH',
  'STX': 'TX',
  'SWA': 'WA',
};

interface EiaRow {
  period: string;
  duoarea: string;
  product: string;
  value: string | null;
}

async function fetchEiaData(
  products: string[],
  areas: string[],
  startDate: string,
  endDate: string,
): Promise<EiaRow[]> {
  const allRows: EiaRow[] = [];
  let offset = 0;
  const length = 5000;

  while (true) {
    const params = new URLSearchParams({
      'api_key': EIA_API_KEY!,
      'frequency': 'weekly',
      'data[0]': 'value',
      'start': startDate,
      'end': endDate,
      'sort[0][column]': 'period',
      'sort[0][direction]': 'asc',
      'offset': String(offset),
      'length': String(length),
    });

    // Add facets
    for (const p of products) {
      params.append('facets[product][]', p);
    }
    for (const a of areas) {
      params.append('facets[duoarea][]', a);
    }
    params.append('facets[process][]', 'PTE'); // Retail sales only

    const url = `${BASE_URL}?${params.toString()}`;
    console.log(`  Fetching offset=${offset}...`);

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`EIA API error ${res.status}: ${body}`);
    }

    const json = await res.json() as any;
    const rows = json.response?.data || [];
    const total = parseInt(json.response?.total || '0', 10);

    allRows.push(...rows);
    offset += length;

    if (offset >= total || rows.length === 0) break;
  }

  return allRows;
}

function convertDate(eiaPeriod: string): string {
  // EIA weekly dates are already YYYY-MM-DD
  return eiaPeriod;
}

async function main() {
  const args = process.argv.slice(2);
  const yearsBack = parseInt(args.find(a => a.startsWith('--years='))?.split('=')[1] || '3', 10);

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - yearsBack);
  const startStr = startDate.toISOString().split('T')[0];

  console.log(`=== EIA Backfill ===`);
  console.log(`Period: ${startStr} to ${endDate} (${yearsBack} years)`);
  console.log(`Grades: Regular, Mid-Grade, Premium, Diesel`);
  console.log(`Areas: National + 9 states (CA, CO, FL, MA, MN, NY, OH, TX, WA)`);
  console.log('');

  const products = Object.keys(GRADE_MAP);
  const areas = Object.keys(AREA_MAP);

  console.log('Fetching data from EIA API...');
  const rows = await fetchEiaData(products, areas, startStr, endDate);
  console.log(`Received ${rows.length} data points`);

  // Load existing database
  const db = loadDatabase();

  // Process rows into database
  let nationalCount = 0;
  let stateCount = 0;

  for (const row of rows) {
    const date = convertDate(row.period);
    const grade = GRADE_MAP[row.product];
    const area = AREA_MAP[row.duoarea];
    const value = row.value ? parseFloat(row.value) : null;

    if (!grade || !area || value === null || isNaN(value)) continue;

    if (area === 'NATIONAL') {
      // National data
      if (!db.national[date]) {
        db.national[date] = { regular: null, midGrade: null, premium: null, diesel: null };
      }
      db.national[date][grade] = value;
      nationalCount++;
    } else {
      // State data
      if (!db.states[date]) {
        db.states[date] = {};
      }
      if (!db.states[date][area]) {
        db.states[date][area] = { regular: null, midGrade: null, premium: null, diesel: null };
      }
      db.states[date][area][grade] = value;
      stateCount++;
    }
  }

  console.log(`\nInserted: ${nationalCount} national + ${stateCount} state data points`);

  // Save and regenerate API
  saveDatabase(db);
  generateApi(db);

  console.log('\nBackfill complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
