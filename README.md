# Gas Price Tracker

Daily fuel price tracking across the United States, powered by GitHub Actions.

Scrapes national and state-level gas prices from AAA, stores them as a historical database, and serves them as a static JSON API via GitHub Pages.

## Live Dashboard

**[View the dashboard →](https://jacobschulman.github.io/gas-tracker/)**

## API

All endpoints are served as static JSON from GitHub Pages. Base URL:

```
https://jacobschulman.github.io/gas-tracker/api/v1
```

### Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/v1/latest.json` | Current prices — national average + all 51 states |
| `GET /api/v1/national.json` | Full national price history (all grades, all dates) |
| `GET /api/v1/states.json` | Full state price history (all states, all grades, all dates) |
| `GET /api/v1/national/{YYYY-MM-DD}.json` | National prices for a specific date |
| `GET /api/v1/states/{STATE}.json` | Full history for one state (e.g. `CA`, `TX`, `NY`) |
| `GET /api/v1/fuel/{GRADE}.json` | National history for one fuel grade |
| `GET /api/v1/fuel/{GRADE}/states.json` | All states history for one fuel grade |
| `GET /api/v1/fuel/{GRADE}/states/{STATE}.json` | One grade + one state (e.g. diesel in CA) |

### Fuel Grades

| Grade key | Label |
|---|---|
| `regular` | Regular Unleaded |
| `midGrade` | Mid-Grade |
| `premium` | Premium |
| `diesel` | Diesel |
| `e85` | E85 (national only) |

### Examples

**Get the latest diesel price nationally:**
```bash
curl -s https://jacobschulman.github.io/gas-tracker/api/v1/fuel/diesel.json | jq '.data'
```

**Compare diesel in CA vs GA:**
```bash
# California diesel history
curl -s https://jacobschulman.github.io/gas-tracker/api/v1/fuel/diesel/states/CA.json

# Georgia diesel history
curl -s https://jacobschulman.github.io/gas-tracker/api/v1/fuel/diesel/states/GA.json
```

**Get all state prices for today:**
```bash
curl -s https://jacobschulman.github.io/gas-tracker/api/v1/latest.json | jq '.states'
```

### Response Format

**latest.json:**
```json
{
  "date": "2026-03-13",
  "national": {
    "regular": 3.630,
    "midGrade": 4.133,
    "premium": 4.496,
    "diesel": 4.892,
    "e85": 2.908
  },
  "states": {
    "CA": { "regular": 5.416, "midGrade": 5.635, "premium": 5.820, "diesel": 6.268 },
    "TX": { "regular": 3.288, "midGrade": 3.790, "premium": 4.156, "diesel": 4.584 }
  }
}
```

**fuel/{grade}/states/{state}.json:**
```json
{
  "grade": "diesel",
  "state": "CA",
  "data": {
    "2026-03-13": 6.268,
    "2026-03-12": 6.245,
    "2026-03-06": 5.980,
    "2026-02-13": 5.410,
    "2025-03-13": 5.620
  }
}
```

## Data Collection

- **Source:** [AAA Gas Prices](https://gasprices.aaa.com/)
- **Frequency:** Daily at 10am ET via GitHub Actions cron
- **Grades tracked:** Regular, Mid-Grade, Premium, Diesel (+ E85 national)
- **Coverage:** National average + all 50 states + DC
- **Backfill:** Each scrape captures current + yesterday + week ago + month ago + year ago prices, gradually filling in historical data

## Development

```bash
# Install dependencies
npm install

# Quick scrape (national + state summary, ~5 seconds)
npm run scrape:quick

# Full scrape with state-level historical backfill (~8.5 min, respects crawl delay)
npm run scrape:backfill

# Regenerate API files from database
npm run api
```

## Architecture

```
gas-tracker/
├── src/
│   ├── types.ts          # Type definitions
│   ├── scraper.ts        # AAA website scraper
│   ├── database.ts       # JSON database with upsert logic
│   ├── api-generator.ts  # Static API file generator
│   └── main.ts           # CLI entry point
├── data/
│   └── database.json     # Historical price database
├── api/v1/               # Generated static API files
├── docs/
│   └── index.html        # Dashboard frontend
└── .github/workflows/
    ├── scrape.yml        # Daily scrape cron
    └── pages.yml         # GitHub Pages deploy
```
