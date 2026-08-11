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
| Spreadsheet accounts editor (`/accounts`) | ✅ |
| Spreadsheet holdings editor (`/holdings`) | ✅ |
| BYOK AI settings (`/settings`) | ✅ |
| CSV + manual balance ingestion UI | ✅ |
| Weekly AI Advisor UI + `/api/chat` | ✅ |
| Demo/placeholder data without DB | ✅ |
| Postgres seed (Hang Seng / Firstrade / Property) | ✅ — `npm run db:setup` |
| Persist to Postgres | Optional — set `DATABASE_URL` |
| Live OpenAI/Anthropic advice | BYOK in Settings, or server env keys |

## Deploy on Vercel

1. Import [Charleschtsoi/WealthSpace](https://github.com/Charleschtsoi/WealthSpace) into Vercel (Production branch: `main`).
2. Optional env vars:
   - `DATABASE_URL` — Postgres connection string (Neon/Supabase/etc.)
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — demo fallback if user has no BYOK key
3. Deploy. Without env vars the site still loads with demo portfolio data. Users can add their own AI key under **Settings**.
4. After first deploy with `DATABASE_URL`, run schema push + seed once (Vercel CLI, Neon SQL, or any machine with the same URL):

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

### Postgres (live dashboard data)

Without `DATABASE_URL`, the dashboard uses built-in placeholders and shows a demo banner.

With a local Postgres database:

```bash
# 1. Put a connection string in .env (see .env.example)
# 2. Push schema + seed Hang Seng / Firstrade / Property profile
npm run db:setup

# Idempotent re-seed (safe to re-run)
npm run db:seed

# Destructive wipe + re-seed
npm run db:seed:reset
```

`db:setup` runs `prisma db push` then the seed. The seed upserts **Accounts**, **Holdings**, **Transactions**, and **NetWorthSnapshots**. When those tables are populated, the dashboard reads from Postgres and the demo banner is hidden.

## Routes

| Path | Description |
|------|-------------|
| `/` | Net worth summary, line chart, allocation donut, holdings |
| `/accounts` | Sheets-like accounts editor |
| `/holdings` | Sheets-like holdings editor (qty / prices / MV) |
| `/upload` | CSV ingestion + manual balance updates |
| `/advisor` | Weekly AI rebalancing plan |
| `/settings` | BYOK AI provider settings |
| `/api/chat` | Streaming advisor endpoint |
| `/api/ai/test` | BYOK connection test |

## CSV format

```csv
Date,Account,Ticker/Description,Amount,Currency
2026-08-01,Firstrade,BUY VOO,2500,USD
```
