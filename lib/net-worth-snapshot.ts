import { type PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  computeNetWorthFromLedger,
  type ComputedNetWorth,
  type ValuationAccountInput,
  type ValuationHoldingInput,
} from "@/lib/valuation";

export {
  computeNetWorthFromLedger,
  type ComputedNetWorth,
} from "@/lib/valuation";

/**
 * Double-count rules for total assets (WS-27 / WS-31):
 * see `lib/valuation.ts` for the canonical documentation.
 */

export type SnapshotAccountInput = ValuationAccountInput;
export type SnapshotHoldingInput = ValuationHoldingInput;

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

    const computed: ComputedNetWorth = computeNetWorthFromLedger(
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
