/**
 * WealthSpace Postgres seed — Hang Seng / Firstrade / Property profile.
 *
 * Default (idempotent): upserts by natural keys; safe to re-run.
 * Reset (destructive): `npm run db:seed:reset` or `tsx prisma/seed.ts --reset`
 */
import {
  PrismaClient,
  AccountType,
  TransactionType,
  type Prisma,
} from "@prisma/client";
import {
  PLACEHOLDER_ACCOUNTS,
  PLACEHOLDER_HOLDINGS,
  PLACEHOLDER_SNAPSHOTS,
} from "../lib/placeholder-data";

const prisma = new PrismaClient();

const RESET =
  process.argv.includes("--reset") || process.env.SEED_RESET === "1";

const SEED_TRANSACTIONS: Array<{
  accountName: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
}> = [
  {
    accountName: "Hang Seng",
    type: TransactionType.DEPOSIT,
    amount: 12000,
    date: "2026-08-02",
    description: "Salary deposit",
  },
  {
    accountName: "Firstrade",
    type: TransactionType.BUY,
    amount: 2500,
    date: "2026-08-01",
    description: "BUY VOO",
  },
];

async function wipeAll() {
  await prisma.transaction.deleteMany();
  await prisma.assetHolding.deleteMany();
  await prisma.netWorthSnapshot.deleteMany();
  await prisma.account.deleteMany();
}

async function upsertAccounts() {
  const byName = new Map<string, string>();

  for (const account of PLACEHOLDER_ACCOUNTS) {
    const existing = await prisma.account.findFirst({
      where: { name: account.name },
    });

    const data: Prisma.AccountCreateInput = {
      name: account.name,
      type: account.type as AccountType,
      balance: account.balance,
      currency: account.currency,
      lastUpdated: new Date(account.lastUpdated),
    };

    if (existing) {
      const updated = await prisma.account.update({
        where: { id: existing.id },
        data: {
          type: data.type,
          balance: data.balance,
          currency: data.currency,
          lastUpdated: data.lastUpdated,
        },
      });
      byName.set(account.name, updated.id);
    } else {
      const created = await prisma.account.create({ data });
      byName.set(account.name, created.id);
    }
  }

  return byName;
}

async function upsertHoldings(accountIdsByName: Map<string, string>) {
  for (const holding of PLACEHOLDER_HOLDINGS) {
    const account = PLACEHOLDER_ACCOUNTS.find((a) => a.id === holding.accountId);
    if (!account) {
      throw new Error(`Seed holding ${holding.ticker} references unknown account`);
    }
    const accountId = accountIdsByName.get(account.name);
    if (!accountId) {
      throw new Error(`Missing seeded account id for ${account.name}`);
    }

    const existing = await prisma.assetHolding.findFirst({
      where: { accountId, ticker: holding.ticker },
    });

    const data = {
      accountId,
      ticker: holding.ticker,
      quantity: holding.quantity,
      averagePrice: holding.averagePrice,
      currentPrice: holding.currentPrice,
      currency: holding.currency,
    };

    if (existing) {
      await prisma.assetHolding.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.assetHolding.create({ data });
    }
  }
}

async function upsertTransactions(accountIdsByName: Map<string, string>) {
  for (const tx of SEED_TRANSACTIONS) {
    const accountId = accountIdsByName.get(tx.accountName);
    if (!accountId) {
      throw new Error(`Missing seeded account id for ${tx.accountName}`);
    }

    const date = new Date(tx.date);
    const existing = await prisma.transaction.findFirst({
      where: {
        accountId,
        type: tx.type,
        amount: tx.amount,
        date,
        description: tx.description,
      },
    });

    if (existing) continue;

    await prisma.transaction.create({
      data: {
        accountId,
        type: tx.type,
        amount: tx.amount,
        date,
        description: tx.description,
      },
    });
  }
}

async function upsertSnapshots() {
  for (const snapshot of PLACEHOLDER_SNAPSHOTS) {
    await prisma.netWorthSnapshot.upsert({
      where: { date: new Date(snapshot.date) },
      create: {
        date: new Date(snapshot.date),
        totalAssets: snapshot.totalAssets,
        totalLiabilities: snapshot.totalLiabilities,
        netWorth: snapshot.netWorth,
      },
      update: {
        totalAssets: snapshot.totalAssets,
        totalLiabilities: snapshot.totalLiabilities,
        netWorth: snapshot.netWorth,
      },
    });
  }
}

async function main() {
  if (RESET) {
    console.log("SEED_RESET: wiping Accounts, Holdings, Transactions, Snapshots…");
    await wipeAll();
  }

  const accountIds = await upsertAccounts();
  await upsertHoldings(accountIds);
  await upsertTransactions(accountIds);
  await upsertSnapshots();

  const counts = {
    accounts: await prisma.account.count(),
    holdings: await prisma.assetHolding.count(),
    transactions: await prisma.transaction.count(),
    snapshots: await prisma.netWorthSnapshot.count(),
  };

  console.log(
    `WealthSpace seed complete${RESET ? " (reset)" : " (idempotent)"}.`,
    counts
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
