import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyHoldingTrade,
  balanceDeltaForType,
  inferTransactionType,
  importFingerprint,
  parseTradeDescription,
  planCsvImport,
  type HoldingLotState,
} from "@/lib/csv-import";

describe("inferTransactionType", () => {
  it("detects BUY/SELL from description", () => {
    assert.equal(inferTransactionType("BUY VOO 4.73", 2500), "BUY");
    assert.equal(inferTransactionType("SELL AAPL", -1800), "SELL");
  });

  it("falls back to amount sign for cash moves", () => {
    assert.equal(inferTransactionType("Salary", 12000), "DEPOSIT");
    assert.equal(inferTransactionType("ATM", -50), "WITHDRAWAL");
  });
});

describe("parseTradeDescription", () => {
  it("parses ticker + qty + optional price", () => {
    assert.deepEqual(parseTradeDescription("BUY VOO 4.73"), {
      ticker: "VOO",
      quantity: 4.73,
      price: null,
    });
    assert.deepEqual(parseTradeDescription("BUY 8 AAPL @ 228.4"), {
      ticker: "AAPL",
      quantity: 8,
      price: 228.4,
    });
    assert.deepEqual(parseTradeDescription("SELL META trim"), {
      ticker: "META",
      quantity: null,
      price: null,
    });
  });
});

describe("balanceDeltaForType", () => {
  it("applies predictable cash effects", () => {
    assert.equal(balanceDeltaForType("DEPOSIT", 100), 100);
    assert.equal(balanceDeltaForType("DEPOSIT", -100), 100);
    assert.equal(balanceDeltaForType("WITHDRAWAL", 50), -50);
    assert.equal(balanceDeltaForType("BUY", 2500), -2500);
    assert.equal(balanceDeltaForType("SELL", -1800), 1800);
  });
});

describe("planCsvImport", () => {
  it("infers types and marks duplicates", () => {
    const plan = planCsvImport(
      [
        {
          Date: "2026-08-01",
          Account: "Firstrade",
          "Ticker/Description": "BUY VOO",
          Amount: "2500",
          Currency: "USD",
          Quantity: "4.73",
        },
        {
          Date: "2026-08-01",
          Account: "Firstrade",
          "Ticker/Description": "BUY VOO",
          Amount: "2500",
          Currency: "USD",
          Quantity: "4.73",
        },
        {
          Date: "2026-08-02",
          Account: "Hang Seng",
          "Ticker/Description": "Salary deposit",
          Amount: "12000",
          Currency: "USD",
        },
      ],
      []
    );

    assert.equal(plan.preview[0].type, "BUY");
    assert.equal(plan.preview[0].ticker, "VOO");
    assert.equal(plan.preview[0].quantity, 4.73);
    assert.ok(plan.preview[0].price != null);
    assert.equal(plan.preview[0].holdingAction, "increase");
    assert.equal(plan.preview[0].isDuplicate, false);

    assert.equal(plan.preview[1].isDuplicate, true);
    assert.equal(plan.duplicates.length, 1);
    assert.equal(plan.toImport.length, 2);

    assert.equal(plan.preview[2].type, "DEPOSIT");
    assert.equal(plan.preview[2].balanceDelta, 12000);
    assert.equal(plan.preview[2].holdingAction, "none");
  });

  it("skips rows matching existing fingerprints", () => {
    const fp = importFingerprint({
      date: "2026-08-02",
      accountName: "Hang Seng",
      type: "DEPOSIT",
      amount: 12000,
      description: "Salary deposit",
    });
    const plan = planCsvImport(
      [
        {
          Date: "2026-08-02",
          Account: "Hang Seng",
          "Ticker/Description": "Salary deposit",
          Amount: "12000",
          Currency: "USD",
        },
      ],
      [fp]
    );
    assert.equal(plan.toImport.length, 0);
    assert.equal(plan.duplicates.length, 1);
  });

  it("warns when BUY lacks quantity", () => {
    const plan = planCsvImport([
      {
        Date: "2026-08-01",
        Account: "Firstrade",
        "Ticker/Description": "BUY VOO",
        Amount: "2500",
        Currency: "USD",
      },
    ]);
    assert.equal(plan.preview[0].holdingAction, "none");
    assert.ok(plan.preview[0].warning?.includes("Quantity"));
  });
});

describe("applyHoldingTrade", () => {
  it("creates and averages buys, then reduces on sell", () => {
    const lots = new Map<string, HoldingLotState>();
    const buy1 = applyHoldingTrade(lots, {
      accountName: "Firstrade",
      ticker: "VOO",
      type: "BUY",
      quantity: 2,
      price: 100,
      currency: "USD",
    });
    assert.ok(buy1);
    assert.equal(buy1.quantity, 2);
    assert.equal(buy1.averagePrice, 100);

    const buy2 = applyHoldingTrade(lots, {
      accountName: "Firstrade",
      ticker: "VOO",
      type: "BUY",
      quantity: 2,
      price: 200,
      currency: "USD",
    });
    assert.ok(buy2);
    assert.equal(buy2.quantity, 4);
    assert.equal(buy2.averagePrice, 150);

    const sell = applyHoldingTrade(lots, {
      accountName: "Firstrade",
      ticker: "VOO",
      type: "SELL",
      quantity: 1,
      price: 210,
      currency: "USD",
    });
    assert.ok(sell);
    assert.equal(sell.quantity, 3);
    assert.equal(sell.averagePrice, 150);
    assert.equal(sell.remove, false);

    const sellAll = applyHoldingTrade(lots, {
      accountName: "Firstrade",
      ticker: "VOO",
      type: "SELL",
      quantity: 3,
      price: 210,
      currency: "USD",
    });
    assert.ok(sellAll);
    assert.equal(sellAll.remove, true);
    assert.equal(lots.size, 0);
  });
});
