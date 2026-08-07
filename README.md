# WealthSpace

Personal wealth management and investment advisory dashboard (MVP).

## Stack

- **Next.js 14** (App Router) + TypeScript
- **PostgreSQL** via **Prisma** (optional for MVP — placeholder data works without it)
- **Tailwind CSS** + Shadcn-style UI primitives
- **Recharts** for net-worth and allocation charts
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) for the weekly advisor

## MVP scope

| Area | Status |
|------|--------|
| Dashboard (net worth, charts, holdings) | ✅ |
| CSV + manual balance ingestion UI | ✅ |
| Weekly AI Advisor UI + `/api/chat` | ✅ |
| Demo/placeholder data without DB | ✅ |
| Persist to Postgres | Optional — set `DATABASE_URL` |
| Live OpenAI advice | Optional — set `OPENAI_API_KEY` |

## Deploy on Vercel

1. Import [Charleschtsoi/WealthSpace](https://github.com/Charleschtsoi/WealthSpace) into Vercel (Production branch: `main`).
2. Optional env vars:
   - `DATABASE_URL` — Postgres connection string (Neon/Supabase/etc.)
   - `OPENAI_API_KEY` — enables Weekly AI Advisor
3. Deploy. Without env vars the site still loads with demo portfolio data.

If you previously saw `404: NOT_FOUND` on `wealth-space.vercel.app`, Production was pointing at an empty `main`. Redeploy after this MVP lands on `main`.

Local DB after deploy (optional):

```bash
npx prisma db push
npm run db:seed
```

## Getting started (local)

```bash
cp .env.example .env
# Optionally set DATABASE_URL and OPENAI_API_KEY

npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
