import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLACEHOLDER_ACCOUNTS,
  PLACEHOLDER_HOLDINGS,
} from "@/lib/placeholder-data";
import {
  computeNetWorthFromLedger,
  mismatchThreshold,
  reconcileLedger,
  RECONCILIATION_ABS_THRESHOLD,
  roundMoney,
} from "@/lib/valuation";

describe("reconcileLedger", () => {
  it("flags brokerage when stated balance diverges from holdings MV", () => {
    const issues = reconcileLedger(
      [
        {
          id: "broker",
          name: "Firstrade",
          type: "BROKERAGE",
          balance: 412_800,
        },
      ],
      [
        { accountId: "broker", quantity: 220, currentPrice: 528.4 },
        { accountId: "broker", quantity: 480, currentPrice: 62.35 },
      ]
    );

    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, "BROKERAGE_BALANCE_VS_HOLDINGS");
    assert.equal(issues[0].accountId, "broker");
    assert.equal(issues[0].links.accounts, "/money?tab=accounts");
    assert.equal(issues[0].links.holdings, "/money?tab=holdings");
    assert.match(issues[0].message, /Firstrade/);
    assert.match(issues[0].fixHint, /account balance|holdings/i);
  });

  it("does not flag when balance matches holdings within threshold", () => {
    const holdingsMv = roundMoney(10 * 100);
    const issues = reconcileLedger(
      [
        {
          id: "broker",
          name: "Match",
          type: "BROKERAGE",
          balance: holdingsMv,
        },
      ],
      [{ accountId: "broker", quantity: 10, currentPrice: 100 }]
    );
    assert.deepEqual(issues, []);
  });

  it("does not flag brokerage/crypto accounts without holdings", () => {
    const issues = reconcileLedger(
      [
        { id: "b", name: "Empty broker", type: "BROKERAGE", balance: 50_000 },
        { id: "c", name: "Empty crypto", type: "CRYPTO", balance: 2_000 },
      ],
      []
    );
    assert.deepEqual(issues, []);
  });

  it("never flags CASH or REAL_ESTATE (no false positives)", () => {
    const issues = reconcileLedger(
      [
        { id: "cash", name: "Hang Seng", type: "CASH", balance: 84_250 },
        {
          id: "re",
          name: "Property",
          type: "REAL_ESTATE",
          balance: 920_000,
        },
        // Stray holdings should still not create RE/CASH issues
      ],
      [
        { accountId: "cash", quantity: 1, currentPrice: 999 },
        { accountId: "re", quantity: 1, currentPrice: 999 },
      ]
    );
    assert.deepEqual(issues, []);
  });

  it("uses crypto-specific issue code", () => {
    const issues = reconcileLedger(
      [{ id: "cry", name: "Coinbase", type: "CRYPTO", balance: 10_000 }],
      [{ accountId: "cry", quantity: 1, currentPrice: 100 }]
    );
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, "CRYPTO_BALANCE_VS_HOLDINGS");
  });

  it("flags the demo Firstrade seed profile", () => {
    const issues = reconcileLedger(PLACEHOLDER_ACCOUNTS, PLACEHOLDER_HOLDINGS);
    assert.ok(issues.length >= 1);
    assert.ok(
      issues.some(
        (i) =>
          i.accountId === "acc_broker_ft" &&
          i.code === "BROKERAGE_BALANCE_VS_HOLDINGS"
      )
    );
  });
});

describe("mismatchThreshold", () => {
  it("uses absolute floor for small balances", () => {
    assert.equal(mismatchThreshold(10, 10), RECONCILIATION_ABS_THRESHOLD);
  });

  it("scales with the larger of stated vs computed", () => {
    const t = mismatchThreshold(1_000_000, 0);
    assert.equal(t, 5_000);
  });
});

describe("computeNetWorthFromLedger (valuation)", () => {
  it("includes unmarked brokerage balance and excludes when holdings exist", () => {
    const withLots = computeNetWorthFromLedger(
      [
        { id: "cash", type: "CASH", balance: 1_000 },
        { id: "broker", type: "BROKERAGE", balance: 9_999 },
      ],
      [{ accountId: "broker", quantity: 2, currentPrice: 50 }]
    );
    assert.equal(withLots.netWorth, 1_100);

    const noLots = computeNetWorthFromLedger(
      [
        { id: "cash", type: "CASH", balance: 1_000 },
        { id: "broker", type: "BROKERAGE", balance: 9_999 },
      ],
      []
    );
    assert.equal(noLots.netWorth, 10_999);
  });
});
