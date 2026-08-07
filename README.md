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
| BYOK AI settings (`/settings`) | ✅ |
| CSV + manual balance ingestion UI | ✅ |
| Weekly AI Advisor UI + `/api/chat` | ✅ |
| Demo/placeholder data without DB | ✅ |
| Persist to Postgres | Optional — set `DATABASE_URL` |
| Live OpenAI/Anthropic advice | BYOK in Settings, or server env keys |

## Deploy on Vercel

1. Import [Charleschtsoi/WealthSpace](https://github.com/Charleschtsoi/WealthSpace) into Vercel (Production branch: `main`).
2. Optional env vars:
   - `DATABASE_URL` — Postgres connection string (Neon/Supabase/etc.)
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — demo fallback if user has no BYOK key
3. Deploy. Without env vars the site still loads with demo portfolio data. Users can add their own AI key under **Settings**.

After schema changes (e.g. `CRYPTO`, `notes`), run:

```bash
npx prisma db push
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
| `/accounts` | Sheets-like accounts editor |
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
