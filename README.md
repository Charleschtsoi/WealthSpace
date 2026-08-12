# WealthSpace

A personal wealth dashboard for tracking money and getting optional AI advice.

Built by [Charles Tsoi](https://github.com/Charleschtsoi).

See your net worth at a glance. Edit accounts, holdings, and transactions like a spreadsheet. Import CSV activity. If you want, plug in your own AI key and get weekly rebalancing ideas.

This is not financial advice. Demo data and AI answers are only examples. You make your own money decisions.

## What you get

**Dashboard.** Net worth summary, history chart, allocation breakdown, and a holdings table.

**Money workspace** at `/money`. Accounts, holdings, transactions, import, and history in one place.

**Spreadsheet editors.** Change accounts, holdings, and transactions inline.

**CSV import.** Bring in activity with a simple column layout.

**Demo, personal, or live.** Try the sample portfolio, start an empty ledger, or connect Postgres when you are ready.

**Weekly AI advisor.** Streaming chat at `/api/chat`. Bring your own key in Settings, or set server keys if you prefer.

**No database required to start.** You get clearly labeled demo data until you add Postgres.

## Quick start

```bash
git clone https://github.com/Charleschtsoi/WealthSpace.git
cd WealthSpace
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the banner to keep exploring the sample portfolio, or hit **Start with my data** for an empty personal ledger.

### Optional Postgres

```bash
# In .env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"

npm run db:setup      # prisma db push + seed
npm run db:seed       # idempotent re-seed
npm run db:seed:reset # wipe + re-seed
```

Once accounts, holdings, and snapshots exist in Postgres, the UI shows **Live**.

### Deploy on Vercel

1. Import [Charleschtsoi/WealthSpace](https://github.com/Charleschtsoi/WealthSpace) from the `main` branch.
2. Optionally set `DATABASE_URL`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY`.
3. Deploy. With no env vars, the app still runs in clearly labeled **Demo** mode.
4. If you use Postgres, run this once after deploy:

```bash
npx prisma db push
npm run db:seed
```

You can add your own AI key under **Settings** anytime. Without `DATABASE_URL`, spreadsheet edits stay in the browser.

## Stack

| Layer | Choice |
| ----- | ------ |
| App | Next.js 14 (App Router) and TypeScript |
| UI | Tailwind CSS and Shadcn style primitives |
| Charts | Recharts |
| Data | PostgreSQL via Prisma (optional for the MVP) |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) |

## Demo, personal, and live

| Mode | When |
| ---- | ---- |
| **Demo** | No `DATABASE_URL`, empty database, or you chose “Load sample portfolio” |
| **Personal** | You chose “Start with my data” (cookie plus empty editable sheets) |
| **Live** | Postgres has real accounts, holdings, and snapshots |

On demo data, the advisor asks you to acknowledge that first and labels the output as illustrative.

## Routes

| Path | Description |
| ---- | ----------- |
| `/` | Net worth, charts, holdings |
| `/money` | Money workspace (accounts, holdings, transactions, import, history) |
| `/accounts` | Redirects to `/money?tab=accounts` |
| `/holdings` | Redirects to `/money?tab=holdings` |
| `/transactions` | Redirects to `/money?tab=transactions` |
| `/upload` | Redirects to `/money?tab=import` |
| `/advisor` | Weekly AI rebalancing plan |
| `/settings` | BYOK AI and data mode |
| `/api/chat` | Streaming advisor |
| `/api/ai/test` | BYOK connection test |

## CSV format

```csv
Date,Account,Ticker/Description,Amount,Currency
2026-08-01,Firstrade,BUY VOO,2500,USD
```

## What works today

| Area | Status |
| ---- | ------ |
| Dashboard (net worth, charts, holdings) | Done |
| Money workspace | Done |
| Spreadsheet editors | Done |
| BYOK AI settings | Done |
| Demo to live onboarding | Done |
| CSV and manual balance UI | Done |
| Weekly AI advisor and `/api/chat` | Done |
| Demo data without a database | Done |
| Postgres seed (Hang Seng / Firstrade / Property) | Done (`npm run db:setup`) |
| Persist to Postgres | Optional (`DATABASE_URL`) |
| Live OpenAI or Anthropic advice | BYOK or server env keys |

## Contributing

Issues and PRs are welcome. Keep changes focused and follow the existing TypeScript and UI patterns.

## License

MIT. See [LICENSE](LICENSE). Copyright © 2026 Charles Tsoi.

You can use, change, and share the code freely, including commercially. Keep the copyright notice and permission notice from `LICENSE` in copies or substantial parts of the software.
