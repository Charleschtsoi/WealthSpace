import { getPrisma } from "@/lib/prisma";
import {
  PLACEHOLDER_ACCOUNTS,
  PLACEHOLDER_HOLDINGS,
  PLACEHOLDER_SNAPSHOTS,
  computeDashboardMetrics,
  type PlaceholderAccount,
  type PlaceholderHolding,
  type PlaceholderSnapshot,
} from "@/lib/placeholder-data";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export async function getAccounts(): Promise<{
  data: PlaceholderAccount[];
  fromDb: boolean;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { data: PLACEHOLDER_ACCOUNTS, fromDb: false };
  }

  try {
    const accounts = await prisma.account.findMany({
      orderBy: { name: "asc" },
    });
    if (accounts.length === 0) {
      return { data: PLACEHOLDER_ACCOUNTS, fromDb: false };
    }
    return {
      fromDb: true,
      data: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: toNumber(a.balance),
        currency: a.currency,
        lastUpdated: a.lastUpdated.toISOString(),
      })),
    };
  } catch {
    return { data: PLACEHOLDER_ACCOUNTS, fromDb: false };
  }
}

export async function getHoldings(): Promise<{
  data: PlaceholderHolding[];
  fromDb: boolean;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { data: PLACEHOLDER_HOLDINGS, fromDb: false };
  }

  try {
    const holdings = await prisma.assetHolding.findMany({
      include: { account: true },
      orderBy: { ticker: "asc" },
    });
    if (holdings.length === 0) {
      return { data: PLACEHOLDER_HOLDINGS, fromDb: false };
    }
    return {
      fromDb: true,
      data: holdings.map((h) => ({
        id: h.id,
        accountId: h.accountId,
        ticker: h.ticker,
        quantity: toNumber(h.quantity),
        averagePrice: toNumber(h.averagePrice),
        currentPrice: toNumber(h.currentPrice),
        currency: h.currency,
        accountName: h.account.name,
      })),
    };
  } catch {
    return { data: PLACEHOLDER_HOLDINGS, fromDb: false };
  }
}

export async function getNetWorthSnapshots(): Promise<{
  data: PlaceholderSnapshot[];
  fromDb: boolean;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { data: PLACEHOLDER_SNAPSHOTS, fromDb: false };
  }

  try {
    const snapshots = await prisma.netWorthSnapshot.findMany({
      orderBy: { date: "asc" },
    });
    if (snapshots.length === 0) {
      return { data: PLACEHOLDER_SNAPSHOTS, fromDb: false };
    }
    return {
      fromDb: true,
      data: snapshots.map((s) => ({
        id: s.id,
        date: s.date.toISOString().slice(0, 10),
        totalAssets: toNumber(s.totalAssets),
        totalLiabilities: toNumber(s.totalLiabilities),
        netWorth: toNumber(s.netWorth),
      })),
    };
  } catch {
    return { data: PLACEHOLDER_SNAPSHOTS, fromDb: false };
  }
}

export async function getDashboardData() {
  const [accountsResult, holdingsResult, snapshotsResult] = await Promise.all([
    getAccounts(),
    getHoldings(),
    getNetWorthSnapshots(),
  ]);

  const accounts = accountsResult.data;
  const holdings = holdingsResult.data;
  const snapshots = snapshotsResult.data;
  const metrics = computeDashboardMetrics(accounts, holdings);

  return {
    accounts,
    holdings,
    snapshots,
    metrics,
    usingPlaceholderData:
      !accountsResult.fromDb ||
      !holdingsResult.fromDb ||
      !snapshotsResult.fromDb,
  };
}

export async function getPortfolioForAdvisor() {
  const [accountsResult, holdingsResult] = await Promise.all([
    getAccounts(),
    getHoldings(),
  ]);
  const accounts = accountsResult.data;
  const holdings = holdingsResult.data;
  const metrics = computeDashboardMetrics(accounts, holdings);

  return {
    profile: {
      age: 38,
      occupation: "IT Project Manager",
      retirementAge: 55,
      targetAllocation: {
        broadIndex: 0.8,
        individualTech: 0.2,
        preferredTickers: {
          broadIndex: ["VOO", "VXUS"],
          individualTech: ["NVDA", "META"],
        },
      },
    },
    accounts,
    holdings: holdings.map((h) => ({
      ...h,
      marketValue: h.quantity * h.currentPrice,
      costBasis: h.quantity * h.averagePrice,
      unrealizedGain:
        h.quantity * h.currentPrice - h.quantity * h.averagePrice,
    })),
    summary: metrics,
    usingPlaceholderData: !accountsResult.fromDb || !holdingsResult.fromDb,
  };
}
