import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountType } from "@prisma/client";
import {
  computeNetWorthFromLedger,
  formatSnapshotDate,
  localCalendarDateKey,
  recordNetWorthSnapshot,
} from "@/lib/net-worth-snapshot";

describe("localCalendarDateKey", () => {
  it("normalizes to UTC midnight of the local calendar day", () => {
    const now = new Date(2026, 7, 12, 15, 45, 30); // Aug 12 2026 local
    const key = localCalendarDateKey(now);
    assert.equal(formatSnapshotDate(key), "2026-08-12");
    assert.equal(key.toISOString(), "2026-08-12T00:00:00.000Z");
  });

  it("same local day yields the same key (idempotent same-day upsert key)", () => {
    const morning = new Date(2026, 7, 12, 1, 0, 0);
    const evening = new Date(2026, 7, 12, 23, 59, 59);
    assert.equal(
      localCalendarDateKey(morning).getTime(),
      localCalendarDateKey(evening).getTime()
    );
  });

  it("new local day yields a different key (new-day insert)", () => {
    const day1 = localCalendarDateKey(new Date(2026, 7, 12, 23, 0, 0));
    const day2 = localCalendarDateKey(new Date(2026, 7, 13, 0, 30, 0));
    assert.notEqual(day1.getTime(), day2.getTime());
    assert.equal(formatSnapshotDate(day1), "2026-08-12");
    assert.equal(formatSnapshotDate(day2), "2026-08-13");
  });
});

describe("computeNetWorthFromLedger", () => {
  it("sums cash + real estate + holdings and sets liabilities to 0", () => {
    const result = computeNetWorthFromLedger(
      [
        { id: "cash", type: AccountType.CASH, balance: 10_000 },
        { id: "re", type: AccountType.REAL_ESTATE, balance: 500_000 },
        { id: "broker", type: AccountType.BROKERAGE, balance: 250_000 },
      ],
      [
        {
          accountId: "broker",
          quantity: 10,
          currentPrice: 100,
        },
      ]
    );

    // Brokerage balance excluded because holdings exist (double-count rule).
    assert.equal(result.totalAssets, 10_000 + 500_000 + 1_000);
    assert.equal(result.totalLiabilities, 0);
    assert.equal(result.netWorth, result.totalAssets);
  });

  it("includes brokerage/crypto balance when the account has no holdings", () => {
    const result = computeNetWorthFromLedger(
      [
        { id: "broker", type: "BROKERAGE", balance: 12_345.67 },
        { id: "crypto", type: "CRYPTO", balance: 2_000 },
      ],
      []
    );
    assert.equal(result.totalAssets, 14_345.67);
    assert.equal(result.netWorth, 14_345.67);
  });

  it("matches dashboard-style seed profile without double-counting Firstrade", () => {
    const result = computeNetWorthFromLedger(
      [
        { id: "acc_cash", type: "CASH", balance: 84_250 },
        { id: "acc_broker", type: "BROKERAGE", balance: 412_800 },
        { id: "acc_re", type: "REAL_ESTATE", balance: 920_000 },
      ],
      [
        { accountId: "acc_broker", quantity: 220, currentPrice: 528.4 },
        { accountId: "acc_broker", quantity: 480, currentPrice: 62.35 },
      ]
    );

    const equities = 220 * 528.4 + 480 * 62.35;
    assert.equal(result.totalAssets, round(84_250 + 920_000 + equities));
  });
});

describe("recordNetWorthSnapshot", () => {
  it("no-ops when prisma is null (demo / no DATABASE_URL)", async () => {
    const result = await recordNetWorthSnapshot(null);
    assert.deepEqual(result, {
      ok: true,
      skipped: true,
      reason: "no_database",
    });
  });

  it("creates on first day then updates same-day; inserts on a new day", async () => {
    const store = new Map<
      string,
      {
        date: Date;
        totalAssets: number;
        totalLiabilities: number;
        netWorth: number;
      }
    >();

    let cashBalance = 1000;
    const prisma = {
      account: {
        findMany: async () => [
          { id: "cash", type: AccountType.CASH, balance: cashBalance },
        ],
      },
      assetHolding: {
        findMany: async () => [],
      },
      netWorthSnapshot: {
        findUnique: async ({ where }: { where: { date: Date } }) => {
          const key = where.date.toISOString();
          const row = store.get(key);
          return row ? { id: key, ...row } : null;
        },
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { date: Date };
          create: {
            date: Date;
            totalAssets: number;
            totalLiabilities: number;
            netWorth: number;
          };
          update: {
            totalAssets: number;
            totalLiabilities: number;
            netWorth: number;
          };
        }) => {
          const key = where.date.toISOString();
          const existing = store.get(key);
          if (existing) {
            const next = { ...existing, ...update };
            store.set(key, next);
            return next;
          }
          store.set(key, create);
          return create;
        },
      },
    };

    const day1 = new Date(2026, 7, 12, 9, 0, 0);
    const first = await recordNetWorthSnapshot(prisma as never, day1);
    assert.equal(first.ok, true);
    if (!first.ok || first.skipped) throw new Error("expected create");
    assert.equal(first.created, true);
    assert.equal(first.date, "2026-08-12");
    assert.equal(first.netWorth, 1000);
    assert.equal(store.size, 1);

    cashBalance = 1500;
    const sameDay = await recordNetWorthSnapshot(
      prisma as never,
      new Date(2026, 7, 12, 18, 0, 0)
    );
    assert.equal(sameDay.ok, true);
    if (!sameDay.ok || sameDay.skipped) throw new Error("expected upsert");
    assert.equal(sameDay.created, false);
    assert.equal(sameDay.date, "2026-08-12");
    assert.equal(sameDay.netWorth, 1500);
    assert.equal(store.size, 1);

    cashBalance = 2000;
    const nextDay = await recordNetWorthSnapshot(
      prisma as never,
      new Date(2026, 7, 13, 8, 0, 0)
    );
    assert.equal(nextDay.ok, true);
    if (!nextDay.ok || nextDay.skipped) throw new Error("expected insert");
    assert.equal(nextDay.created, true);
    assert.equal(nextDay.date, "2026-08-13");
    assert.equal(nextDay.netWorth, 2000);
    assert.equal(store.size, 2);
  });
});

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
