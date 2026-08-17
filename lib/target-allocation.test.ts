import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLACEHOLDER_HOLDINGS } from "@/lib/placeholder-data";
import {
  DEFAULT_ALLOCATION_POLICY,
  classifyTicker,
  computeTargetAllocation,
  normalizeAllocationPolicy,
  policyToAdvisorShape,
} from "@/lib/target-allocation";

describe("classifyTicker", () => {
  it("maps preferred tickers to buckets and others to off-policy", () => {
    assert.equal(classifyTicker("voo"), "broadIndex");
    assert.equal(classifyTicker("VXUS"), "broadIndex");
    assert.equal(classifyTicker("NVDA"), "individualTech");
    assert.equal(classifyTicker("meta"), "individualTech");
    assert.equal(classifyTicker("AAPL"), "offPolicy");
    assert.equal(classifyTicker("TSLA"), "offPolicy");
  });
});

describe("computeTargetAllocation", () => {
  it("computes actual vs target % and dollar drift on demo holdings", () => {
    const report = computeTargetAllocation(PLACEHOLDER_HOLDINGS);
    assert.ok(report.equityMarketValue > 0);

    const broad = report.buckets.find((b) => b.id === "broadIndex")!;
    const tech = report.buckets.find((b) => b.id === "individualTech")!;
    const off = report.buckets.find((b) => b.id === "offPolicy")!;

    // Demo book: ~71.7% broad, ~19.3% tech, ~9.0% AAPL off-policy
    assert.ok(broad.actualWeight > 0.7 && broad.actualWeight < 0.73);
    assert.ok(tech.actualWeight > 0.19 && tech.actualWeight < 0.2);
    assert.ok(off.actualWeight > 0.08 && off.actualWeight < 0.1);

    assert.equal(broad.targetWeight, 0.8);
    assert.equal(tech.targetWeight, 0.2);
    assert.equal(off.targetWeight, 0);

    // Broad is underweight → negative drift dollars
    assert.ok(broad.driftDollars < 0);
    assert.ok(off.driftDollars > 0);
    assert.deepEqual(report.offPolicyTickers, ["AAPL"]);
  });

  it("flags single-name overweight for non-broad names above threshold", () => {
    const report = computeTargetAllocation(PLACEHOLDER_HOLDINGS);
    // META ~13.8% > 12% guide; AAPL ~9% should not flag; VOO ~57% extreme
    const byTicker = Object.fromEntries(
      report.concentration.map((c) => [c.ticker, c])
    );
    assert.ok(byTicker.META);
    assert.equal(byTicker.META.reason, "single_name");
    assert.equal(byTicker.AAPL, undefined);
    assert.ok(byTicker.VOO);
    assert.equal(byTicker.VOO.reason, "extreme");
  });

  it("flags extreme concentration even for broad-index names", () => {
    const report = computeTargetAllocation(
      [
        { ticker: "VOO", quantity: 100, currentPrice: 100 },
        { ticker: "NVDA", quantity: 1, currentPrice: 10 },
      ],
      {
        ...DEFAULT_ALLOCATION_POLICY,
        extremeConcentrationThreshold: 0.5,
      }
    );
    const voo = report.concentration.find((c) => c.ticker === "VOO");
    assert.ok(voo);
    assert.equal(voo?.reason, "extreme");
  });

  it("handles empty holdings", () => {
    const report = computeTargetAllocation([]);
    assert.equal(report.equityMarketValue, 0);
    assert.equal(report.holdings.length, 0);
    assert.equal(report.concentration.length, 0);
    for (const b of report.buckets) {
      assert.equal(b.marketValue, 0);
      assert.equal(b.actualWeight, 0);
    }
  });
});

describe("normalizeAllocationPolicy / policyToAdvisorShape", () => {
  it("renormalizes bucket weights that do not sum to 1", () => {
    const policy = normalizeAllocationPolicy({
      buckets: [
        {
          id: "broadIndex",
          label: "Broad index",
          targetWeight: 0.4,
          tickers: ["VOO"],
        },
        {
          id: "individualTech",
          label: "Individual tech",
          targetWeight: 0.1,
          tickers: ["NVDA"],
        },
      ],
    });
    const sum = policy.buckets.reduce((s, b) => s + b.targetWeight, 0);
    assert.ok(Math.abs(sum - 1) < 0.001);
    assert.deepEqual(policy.buckets[0].tickers, ["VOO"]);
  });

  it("exports the advisor-compatible shape", () => {
    const shape = policyToAdvisorShape(DEFAULT_ALLOCATION_POLICY);
    assert.equal(shape.broadIndex, 0.8);
    assert.equal(shape.individualTech, 0.2);
    assert.deepEqual(shape.preferredTickers.broadIndex, ["VOO", "VXUS"]);
    assert.deepEqual(shape.preferredTickers.individualTech, ["NVDA", "META"]);
  });
});
