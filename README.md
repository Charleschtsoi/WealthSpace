# WealthSpace

**Personal wealth dashboard with spreadsheet-style money tracking and optional AI advisory.**

Built by [Charles Tsoi](https://github.com/Charleschtsoi) ([@Charleschtsoi](https://github.com/Charleschtsoi)).

WealthSpace helps you see net worth at a glance, edit accounts / holdings / transactions like a spreadsheet, import CSV activity, and — if you want — get weekly rebalancing ideas from your own AI key (BYOK).

> Not financial advice. Demo and AI outputs are illustrative. You are responsible for your own money decisions.

## Features

- **Dashboard** — net worth summary, history chart, allocation breakdown, holdings table
- **Money workspace** (`/money`) — Accounts, Holdings, Transactions, Import, and History in one place
- **Spreadsheet editors** — edit accounts, holdings, and transactions inline
- **CSV import** — bring in activity with a simple column layout
- **Demo → personal → live** — explore sample data, start an empty ledger, or persist to Postgres
- **Weekly AI Advisor** — streaming chat via `/api/chat` (BYOK in Settings, or optional server keys)
- **Works without a database** — labeled demo data until you configure Postgres

## Quick start

```bash
git clone https://github.com/Charleschtsoi/WealthSpace.git
cd WealthSpace
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the banner to keep exploring the sample portfolio or **Start with my data** for an empty personal ledger.

### Optional Postgres

```bash
# In .env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"

npm run db:setup      # prisma db push + seed
npm run db:seed       # idempotent re-seed
npm run db:seed:reset # wipe + re-seed
```

When accounts/holdings/snapshots exist in Postgres, the UI switches to **Live**.

### Deploy (Vercel)

1. Import [Charleschtsoi/WealthSpace](https://github.com/Charleschtsoi/WealthSpace) (`main`).
2. Optional env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
3. Deploy — without env vars the app still runs in clearly labeled **Demo** mode.
4. With Postgres, run once after deploy:

```bash
npx prisma db push
npm run db:seed
```

Add your own AI key under **Settings** anytime. Spreadsheet edits without `DATABASE_URL` stay in the browser.

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + Shadcn-style primitives |
| Charts | Recharts |
| Data | PostgreSQL via Prisma (optional for MVP) |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) |

## Demo → live path

| Mode | When |
|------|------|
| **Demo** | No `DATABASE_URL`, empty DB, or “Load sample portfolio” |
| **Personal** | “Start with my data” — cookie + empty editable sheets |
| **Live** | Postgres has real accounts / holdings / snapshots |

Advisor on demo data needs an explicit acknowledgment and labels output as illustrative.

## Routes

| Path | Description |
|------|-------------|
| `/` | Net worth, charts, holdings |
| `/money` | Money workspace (tabs for accounts, holdings, transactions, import, history) |
| `/accounts` | → `/money?tab=accounts` |
| `/holdings` | → `/money?tab=holdings` |
| `/transactions` | → `/money?tab=transactions` |
| `/upload` | → `/money?tab=import` |
| `/advisor` | Weekly AI rebalancing plan |
| `/settings` | BYOK AI + data mode |
| `/api/chat` | Streaming advisor |
| `/api/ai/test` | BYOK connection test |

## CSV format

```csv
Date,Account,Ticker/Description,Amount,Currency
2026-08-01,Firstrade,BUY VOO,2500,USD
```

## MVP status

| Area | Status |
|------|--------|
| Dashboard (net worth, charts, holdings) | Done |
| Money workspace | Done |
| Spreadsheet editors | Done |
| BYOK AI settings | Done |
| Demo → live onboarding | Done |
| CSV + manual balance UI | Done |
| Weekly AI Advisor + `/api/chat` | Done |
| Demo data without DB | Done |
| Postgres seed (Hang Seng / Firstrade / Property) | Done (`npm run db:setup`) |
| Persist to Postgres | Optional (`DATABASE_URL`) |
| Live OpenAI / Anthropic advice | BYOK or server env keys |

## Contributing

Issues and PRs are welcome. Please keep changes focused and match existing TypeScript / UI patterns.

## Attribution

If you use, fork, or build on WealthSpace, please credit **Charles Tsoi** and link back to this repository:

`https://github.com/Charleschtsoi/WealthSpace`

Keeping the copyright notice (required by the license) is the baseline; a mention in your README or about page is appreciated.

## License

This project is licensed under the [MIT License](LICENSE) — © 2026 Charles Tsoi.

You may use, modify, and share the code freely, including commercially, as long as you include the copyright notice and permission notice from `LICENSE` in copies or substantial portions of the software.
