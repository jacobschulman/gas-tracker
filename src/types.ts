export interface FuelPrices {
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
  e85?: number | null;
}

export interface NationalSnapshot {
  date: string; // YYYY-MM-DD
  prices: FuelPrices;
  source: 'current' | 'yesterday' | 'week_ago' | 'month_ago' | 'year_ago' | 'daily';
  scrapedAt: string; // ISO timestamp of when we scraped this
}

export interface StateSnapshot {
  date: string;
  state: string; // 2-letter code
  stateName: string;
  prices: FuelPrices;
  source: 'current' | 'yesterday' | 'week_ago' | 'month_ago' | 'year_ago' | 'daily';
  scrapedAt: string;
}

export interface DailyNationalData {
  [date: string]: FuelPrices;
}

export interface DailyStateData {
  [date: string]: {
    [stateCode: string]: FuelPrices;
  };
}

export interface Database {
  national: DailyNationalData;
  states: DailyStateData;
  metadata: {
    lastUpdated: string;
    totalDays: number;
    firstDate: string;
    lastDate: string;
  };
}

export const STATE_CODES: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
  'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};
