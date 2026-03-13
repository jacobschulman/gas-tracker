import * as fs from 'fs';
import * as path from 'path';
import { Database, FuelPrices } from './types';
import { loadDatabase } from './database';

const API_DIR = path.join(__dirname, '..', 'api', 'v1');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

type FuelGrade = 'regular' | 'midGrade' | 'premium' | 'diesel' | 'e85';

function extractGrade(prices: FuelPrices, grade: FuelGrade): number | null {
  return prices[grade] ?? null;
}

export function generateApi(db: Database): void {
  console.log('Generating API files...');

  // /api/v1/latest.json - current snapshot
  const latestDate = db.metadata.lastDate;
  const latest = {
    date: latestDate,
    national: db.national[latestDate] || null,
    states: db.states[latestDate] || {},
    metadata: db.metadata,
  };
  writeJson(path.join(API_DIR, 'latest.json'), latest);

  // /api/v1/national.json - full national history
  writeJson(path.join(API_DIR, 'national.json'), {
    data: db.national,
    metadata: db.metadata,
  });

  // /api/v1/states.json - full state history
  writeJson(path.join(API_DIR, 'states.json'), {
    data: db.states,
    metadata: db.metadata,
  });

  // /api/v1/national/{date}.json - individual day
  for (const [date, prices] of Object.entries(db.national)) {
    writeJson(path.join(API_DIR, 'national', `${date}.json`), { date, prices });
  }

  // /api/v1/states/{stateCode}.json - full history for a state
  const stateHistories: Record<string, Record<string, FuelPrices>> = {};
  for (const [date, states] of Object.entries(db.states)) {
    for (const [code, prices] of Object.entries(states)) {
      if (!stateHistories[code]) stateHistories[code] = {};
      stateHistories[code][date] = prices;
    }
  }
  for (const [code, history] of Object.entries(stateHistories)) {
    writeJson(path.join(API_DIR, 'states', `${code}.json`), {
      state: code,
      data: history,
      metadata: db.metadata,
    });
  }

  // /api/v1/fuel/{grade}.json - national history for a specific grade
  const grades: FuelGrade[] = ['regular', 'midGrade', 'premium', 'diesel', 'e85'];
  for (const grade of grades) {
    const gradeData: Record<string, number | null> = {};
    for (const [date, prices] of Object.entries(db.national)) {
      const val = extractGrade(prices, grade);
      if (val !== null) gradeData[date] = val;
    }
    if (Object.keys(gradeData).length > 0) {
      writeJson(path.join(API_DIR, 'fuel', `${grade}.json`), {
        grade,
        data: gradeData,
        metadata: db.metadata,
      });
    }
  }

  // /api/v1/fuel/{grade}/states.json - all states for a specific grade
  for (const grade of grades) {
    const gradeStateData: Record<string, Record<string, number | null>> = {};
    for (const [date, states] of Object.entries(db.states)) {
      for (const [code, prices] of Object.entries(states)) {
        const val = extractGrade(prices, grade);
        if (val !== null) {
          if (!gradeStateData[code]) gradeStateData[code] = {};
          gradeStateData[code][date] = val;
        }
      }
    }
    if (Object.keys(gradeStateData).length > 0) {
      writeJson(path.join(API_DIR, 'fuel', grade, 'states.json'), {
        grade,
        data: gradeStateData,
        metadata: db.metadata,
      });
    }
  }

  // /api/v1/fuel/{grade}/states/{stateCode}.json - single grade + single state
  for (const grade of grades) {
    for (const [code, history] of Object.entries(stateHistories)) {
      const series: Record<string, number | null> = {};
      for (const [date, prices] of Object.entries(history)) {
        const val = extractGrade(prices, grade);
        if (val !== null) series[date] = val;
      }
      if (Object.keys(series).length > 0) {
        writeJson(path.join(API_DIR, 'fuel', grade, 'states', `${code}.json`), {
          grade,
          state: code,
          data: series,
        });
      }
    }
  }

  console.log('API generation complete.');
}

if (require.main === module) {
  const db = loadDatabase();
  generateApi(db);
}
