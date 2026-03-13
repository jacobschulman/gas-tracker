import * as fs from 'fs';
import * as path from 'path';
import { Database, FuelPrices, NationalSnapshot, StateSnapshot } from './types';

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export function loadDatabase(): Database {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  }
  return {
    national: {},
    states: {},
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalDays: 0,
      firstDate: '',
      lastDate: '',
    },
  };
}

export function saveDatabase(db: Database): void {
  // Update metadata
  const nationalDates = Object.keys(db.national).sort();
  const stateDates = Object.keys(db.states).sort();
  const allDates = [...new Set([...nationalDates, ...stateDates])].sort();

  db.metadata = {
    lastUpdated: new Date().toISOString(),
    totalDays: allDates.length,
    firstDate: allDates[0] || '',
    lastDate: allDates[allDates.length - 1] || '',
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  console.log(`Database saved: ${db.metadata.totalDays} days, ${db.metadata.firstDate} to ${db.metadata.lastDate}`);
}

function mergePrices(existing: FuelPrices | undefined, incoming: FuelPrices): FuelPrices {
  if (!existing) return { ...incoming };
  return {
    regular: incoming.regular ?? existing.regular,
    midGrade: incoming.midGrade ?? existing.midGrade,
    premium: incoming.premium ?? existing.premium,
    diesel: incoming.diesel ?? existing.diesel,
    e85: incoming.e85 ?? existing.e85,
  };
}

export function upsertNational(db: Database, snapshots: NationalSnapshot[]): void {
  for (const snap of snapshots) {
    db.national[snap.date] = mergePrices(db.national[snap.date], snap.prices);
  }
}

export function upsertStates(db: Database, snapshots: StateSnapshot[]): void {
  for (const snap of snapshots) {
    if (!db.states[snap.date]) {
      db.states[snap.date] = {};
    }
    db.states[snap.date][snap.state] = mergePrices(
      db.states[snap.date]?.[snap.state],
      snap.prices
    );
  }
}
