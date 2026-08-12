import { AccountType, type PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

/**
 * Double-count rules for total assets (WS-27):
 * - CASH + REAL_ESTATE: always include account.balance (cash / property mark).
 * - Holdings: always include quantity × currentPrice (equities / crypto lots).
 * - BROKERAGE + CRYPTO balances: include only when that account has no holdings,
 *   so a brokerage balance that mirrors portfolio MV is not double-counted with
 *   line-item holdings. Cash sleeves without lots still count.
 * - Liabilities: 0 until WS-13.
 */

export type SnapshotAccountInput = {
  id: string;
  type: AccountType | string;
  balance: number;
};

export type SnapshotHoldingInput = {
  accountId: string;
  quantity: number;
  currentPrice: number;
};

export type ComputedNetWorth = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export type RecordSnapshotResult =
  | { ok: true; skipped: true; reason: "no_database" }
  | {
      ok: true;
      skipped: false;
      created: boolean;
      date: string;
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
    }
  | { ok: false; error: string };

/** Local calendar day as UTC midnight Date (matches seed / chart date keys). */
export function localCalendarDateKey(now: Date = new Date()): Date {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
}

export function formatSnapshotDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeNetWorthFromLedger(
  accounts: SnapshotAccountInput[],
  holdings: SnapshotHoldingInput[]
): ComputedNetWorth {
  const holdingsByAccount = new Map<string, number>();
  let holdingsMv = 0;

  for (const h of holdings) {
    const mv = Number(h.quantity) * Number(h.currentPrice);
    if (!Number.isFinite(mv)) continue;
    holdingsMv += mv;
    holdingsByAccount.set(
      h.accountId,
      (holdingsByAccount.get(h.accountId) ?? 0) + mv
    );
  }

  let accountAssets = 0;
  for (const account of accounts) {
    const balance = Number(account.balance);
    if (!Number.isFinite(balance)) continue;

    const type = String(account.type);
    if (type === AccountType.CASH || type === "CASH") {
      accountAssets += balance;
      continue;
    }
    if (type === AccountType.REAL_ESTATE || type === "REAL_ESTATE") {
      accountAssets += balance;
      continue;
    }
    if (
      type === AccountType.BROKERAGE ||
      type === "BROKERAGE" ||
      type === AccountType.CRYPTO ||
      type === "CRYPTO"
    ) {
      const hasHoldings = (holdingsByAccount.get(account.id) ?? 0) > 0;
      if (!hasHoldings) {
        accountAssets += balance;
      }
      continue;
    }

    // Unknown types: include balance only if no holdings on the account.
    if (!(holdingsByAccount.get(account.id) ?? 0)) {
      accountAssets += balance;
    }
  }

  const totalAssets = roundMoney(accountAssets + holdingsMv);
  const totalLiabilities = 0;
  const netWorth = roundMoney(totalAssets - totalLiabilities);

  return { totalAssets, totalLiabilities, netWorth };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Upsert today's net-worth snapshot from current ledger truth.
 * No-ops when DATABASE_URL is unset or Prisma is unavailable.
 */
export async function recordNetWorthSnapshot(
  prismaOverride?: PrismaClient | null,
  now: Date = new Date()
): Promise<RecordSnapshotResult> {
  const prisma = prismaOverride === undefined ? getPrisma() : prismaOverride;
  if (!prisma) {
    return { ok: true, skipped: true, reason: "no_database" };
  }

  try {
    const [accounts, holdings] = await Promise.all([
      prisma.account.findMany({
        select: { id: true, type: true, balance: true },
      }),
      prisma.assetHolding.findMany({
        select: { accountId: true, quantity: true, currentPrice: true },
      }),
    ]);

    const computed = computeNetWorthFromLedger(
      accounts.map((a) => ({
        id: a.id,
        type: a.type,
        balance: toNumber(a.balance),
      })),
      holdings.map((h) => ({
        accountId: h.accountId,
        quantity: toNumber(h.quantity),
        currentPrice: toNumber(h.currentPrice),
      }))
    );

    const date = localCalendarDateKey(now);
    const existing = await prisma.netWorthSnapshot.findUnique({
      where: { date },
    });

    await prisma.netWorthSnapshot.upsert({
      where: { date },
      create: {
        date,
        totalAssets: computed.totalAssets,
        totalLiabilities: computed.totalLiabilities,
        netWorth: computed.netWorth,
      },
      update: {
        totalAssets: computed.totalAssets,
        totalLiabilities: computed.totalLiabilities,
        netWorth: computed.netWorth,
      },
    });

    return {
      ok: true,
      skipped: false,
      created: !existing,
      date: formatSnapshotDate(date),
      ...computed,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record snapshot.";
    return { ok: false, error: message };
  }
}
