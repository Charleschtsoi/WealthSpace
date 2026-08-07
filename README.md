# WealthSpace

Personal wealth management and investment advisory dashboard.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **PostgreSQL** via **Prisma**
- **Tailwind CSS** + Shadcn-style UI primitives
- **Recharts** for net-worth and allocation charts
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) for the weekly advisor

## Getting started

```bash
cp .env.example .env
# Set DATABASE_URL and OPENAI_API_KEY

npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without a database, the dashboard and advisor still render using built-in placeholder portfolio data.

## Routes

| Path | Description |
|------|-------------|
| `/` | Net worth summary, line chart, allocation donut, holdings |
| `/upload` | CSV ingestion + manual balance updates |
| `/advisor` | Weekly AI rebalancing plan |
| `/api/chat` | Streaming advisor endpoint |

## CSV format

```csv
Date,Account,Ticker/Description,Amount,Currency
2026-08-01,Firstrade,BUY VOO,2500,USD
```
