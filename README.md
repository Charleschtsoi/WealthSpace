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
| Money workspace (`/money`) — Accounts / Holdings / Transactions / Import / History | ✅ |
| Spreadsheet accounts + holdings + transactions editors | ✅ |
| BYOK AI settings (`/settings`) | ✅ |
| Demo → live onboarding banner | ✅ |
| CSV + manual balance ingestion UI | ✅ |
| Weekly AI Advisor UI + `/api/chat` | ✅ |
| Demo/placeholder data without DB | ✅ |
| Persist to Postgres | Optional — set `DATABASE_URL` |
| Live OpenAI/Anthropic advice | BYOK in Settings, or server env keys |

## Demo → live path

Without `DATABASE_URL` (or with an empty database), WealthSpace can show a **sample portfolio**. That mode is labeled **Demo** in a persistent banner on the dashboard, advisor, and settings.

| Action | What happens |
|--------|----------------|
| **Start with my data** | Sets a `wealthspace_data_mode=personal` cookie, clears browser-local demo sheets, and opens empty editable Accounts. |
| **Load sample portfolio** | Switches back to demo UI data for exploration. To put the sample into Postgres, run `npm run db:seed`. |
| **Live** | Appears automatically once Postgres has real accounts/holdings/snapshots. |

Advisor on demo data requires an explicit acknowledgment and labels output as **illustrative**.

### Local

```bash
cp .env.example .env
# Optional: DATABASE_URL, OPENAI_API_KEY / ANTHROPIC_API_KEY

npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → use the banner to start a personal ledger, or keep exploring demo data.

With Postgres:

```bash
npx prisma db push
npm run db:seed   # optional sample ledger in the DB
```

### Vercel

1. Import [Charleschtsoi/WealthSpace](https://github.com/Charleschtsoi/WealthSpace) (Production branch: `main`).
2. Optional env vars:
   - `DATABASE_URL` — Postgres (Neon/Supabase/etc.)
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — demo fallback if the user has no BYOK key
3. Deploy. Without env vars the site still loads with **Demo** data clearly labeled.
4. After schema changes, run `npx prisma db push` against the production database (from CI, a one-off job, or locally with the prod URL).

Users can add their own AI key under **Settings**. Spreadsheet saves without `DATABASE_URL` stay in the browser until Postgres is configured.

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
| `/money` | Money workspace (Accounts, Holdings, Transactions, Import, History) |
| `/accounts` | Redirects to `/money?tab=accounts` |
| `/holdings` | Redirects to `/money?tab=holdings` |
| `/transactions` | Redirects to `/money?tab=transactions` |
| `/upload` | Redirects to `/money?tab=import` |
| `/advisor` | Weekly AI rebalancing plan |
| `/settings` | BYOK AI + demo/personal data mode |
| `/api/chat` | Streaming advisor endpoint |
| `/api/ai/test` | BYOK connection test |

## CSV format

```csv
Date,Account,Ticker/Description,Amount,Currency
2026-08-01,Firstrade,BUY VOO,2500,USD
```
