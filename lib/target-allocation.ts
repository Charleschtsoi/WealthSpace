/**
 * WS-04 — Target allocation policy, drift, and concentration helpers.
 * Pure planner shared by dashboard (server + local ledger) and advisor.
 */

export type PolicyBucketId = "broadIndex" | "individualTech" | "offPolicy";

export type AllocationPolicyBucket = {
  id: Exclude<PolicyBucketId, "offPolicy">;
  label: string;
  /** Fraction of equity book, 0–1 */
  targetWeight: number;
  /** Tickers that count toward this bucket (case-insensitive) */
  tickers: string[];
};

export type AllocationPolicy = {
  buckets: AllocationPolicyBucket[];
  offPolicyLabel: string;
  /**
   * Flag a non–broad-index name when its weight exceeds this fraction
   * of the equity book (default 12%).
   */
  concentrationThreshold: number;
  /**
   * Flag any ticker (including broad index) above this extreme weight
   * (default 40%).
   */
  extremeConcentrationThreshold: number;
};

export type HoldingMarketInput = {
  ticker: string;
  quantity: number;
  currentPrice: number;
};

export type ClassifiedHolding = {
  ticker: string;
  marketValue: number;
  weight: number;
  bucketId: PolicyBucketId;
};

export type BucketDrift = {
  id: PolicyBucketId;
  label: string;
  marketValue: number;
  actualWeight: number;
  targetWeight: number;
  /** actualWeight − targetWeight (positive = overweight) */
  driftWeight: number;
  /** Dollar gap vs target: actual − target$ */
  driftDollars: number;
  tickers: string[];
};

export type ConcentrationAlert = {
  ticker: string;
  marketValue: number;
  weight: number;
  bucketId: PolicyBucketId;
  reason: "single_name" | "extreme";
  message: string;
};

export type TargetAllocationReport = {
  policy: AllocationPolicy;
  equityMarketValue: number;
  holdings: ClassifiedHolding[];
  buckets: BucketDrift[];
  concentration: ConcentrationAlert[];
  offPolicyTickers: string[];
};

export const DEFAULT_ALLOCATION_POLICY: AllocationPolicy = {
  buckets: [
    {
      id: "broadIndex",
      label: "Broad index",
      targetWeight: 0.8,
      tickers: ["VOO", "VXUS"],
    },
    {
      id: "individualTech",
      label: "Individual tech",
      targetWeight: 0.2,
      tickers: ["NVDA", "META"],
    },
  ],
  offPolicyLabel: "Off-policy",
  concentrationThreshold: 0.12,
  extremeConcentrationThreshold: 0.4,
};

const STORAGE_KEY = "wealthspace.target-allocation.v1";

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build a ticker → bucket map from policy (first matching bucket wins). */
export function buildTickerBucketMap(
  policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY
): Map<string, Exclude<PolicyBucketId, "offPolicy">> {
  const map = new Map<string, Exclude<PolicyBucketId, "offPolicy">>();
  for (const bucket of policy.buckets) {
    for (const ticker of bucket.tickers) {
      const key = normalizeTicker(ticker);
      if (!map.has(key)) map.set(key, bucket.id);
    }
  }
  return map;
}

export function classifyTicker(
  ticker: string,
  policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY
): PolicyBucketId {
  const map = buildTickerBucketMap(policy);
  return map.get(normalizeTicker(ticker)) ?? "offPolicy";
}

export function holdingMarketValue(h: HoldingMarketInput): number {
  const qty = Number(h.quantity) || 0;
  const price = Number(h.currentPrice) || 0;
  return qty * price;
}

/**
 * Compute actual vs target allocation drift and concentration alerts
 * from live holdings market values (quantity × currentPrice).
 */
export function computeTargetAllocation(
  holdings: HoldingMarketInput[],
  policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY
): TargetAllocationReport {
  const tickerMap = buildTickerBucketMap(policy);

  const classified: ClassifiedHolding[] = [];
  let equityMarketValue = 0;

  for (const h of holdings) {
    const ticker = normalizeTicker(h.ticker);
    if (!ticker) continue;
    const marketValue = holdingMarketValue(h);
    if (!(marketValue > 0)) continue;
    equityMarketValue += marketValue;
    const bucketId = tickerMap.get(ticker) ?? "offPolicy";
    classified.push({ ticker, marketValue, weight: 0, bucketId });
  }

  for (const row of classified) {
    row.weight = equityMarketValue > 0 ? row.marketValue / equityMarketValue : 0;
  }

  const bucketDefs: Array<{
    id: PolicyBucketId;
    label: string;
    targetWeight: number;
  }> = [
    ...policy.buckets.map((b) => ({
      id: b.id as PolicyBucketId,
      label: b.label,
      targetWeight: b.targetWeight,
    })),
    { id: "offPolicy", label: policy.offPolicyLabel, targetWeight: 0 },
  ];

  const buckets: BucketDrift[] = bucketDefs.map((def) => {
    const rows = classified.filter((c) => c.bucketId === def.id);
    const marketValue = rows.reduce((sum, r) => sum + r.marketValue, 0);
    const actualWeight = equityMarketValue > 0 ? marketValue / equityMarketValue : 0;
    const targetDollars = equityMarketValue * def.targetWeight;
    return {
      id: def.id,
      label: def.label,
      marketValue: round2(marketValue),
      actualWeight: round4(actualWeight),
      targetWeight: def.targetWeight,
      driftWeight: round4(actualWeight - def.targetWeight),
      driftDollars: round2(marketValue - targetDollars),
      tickers: Array.from(new Set(rows.map((r) => r.ticker))).sort(),
    };
  });

  const broadTickers = new Set(
    (policy.buckets.find((b) => b.id === "broadIndex")?.tickers ?? []).map(
      normalizeTicker
    )
  );

  const concentration: ConcentrationAlert[] = [];
  for (const row of classified) {
    const weight = row.weight;
    if (weight >= policy.extremeConcentrationThreshold) {
      concentration.push({
        ticker: row.ticker,
        marketValue: round2(row.marketValue),
        weight: round4(weight),
        bucketId: row.bucketId,
        reason: "extreme",
        message: `${row.ticker} is ${(weight * 100).toFixed(1)}% of equities — extreme single-name concentration.`,
      });
      continue;
    }
    // Broad-index sleeve names are expected to be large; only warn non-broad.
    if (broadTickers.has(row.ticker)) continue;
    if (weight >= policy.concentrationThreshold) {
      concentration.push({
        ticker: row.ticker,
        marketValue: round2(row.marketValue),
        weight: round4(weight),
        bucketId: row.bucketId,
        reason: "single_name",
        message: `${row.ticker} is ${(weight * 100).toFixed(1)}% of equities — above the ${(policy.concentrationThreshold * 100).toFixed(0)}% single-name guide.`,
      });
    }
  }

  concentration.sort((a, b) => b.weight - a.weight);

  const offPolicyTickers = Array.from(
    new Set(
      classified.filter((c) => c.bucketId === "offPolicy").map((c) => c.ticker)
    )
  ).sort();

  return {
    policy,
    equityMarketValue: round2(equityMarketValue),
    holdings: classified.map((c) => ({
      ...c,
      marketValue: round2(c.marketValue),
      weight: round4(c.weight),
    })),
    buckets,
    concentration,
    offPolicyTickers,
  };
}

/** Advisor-facing policy shape (matches existing getPortfolioForAdvisor). */
export function policyToAdvisorShape(policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY) {
  const broad = policy.buckets.find((b) => b.id === "broadIndex");
  const tech = policy.buckets.find((b) => b.id === "individualTech");
  return {
    broadIndex: broad?.targetWeight ?? 0.8,
    individualTech: tech?.targetWeight ?? 0.2,
    preferredTickers: {
      broadIndex: broad?.tickers ?? ["VOO", "VXUS"],
      individualTech: tech?.tickers ?? ["NVDA", "META"],
    },
  };
}

function isValidWeight(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Merge a partial stored policy onto defaults (invalid fields ignored). */
export function normalizeAllocationPolicy(
  input: Partial<AllocationPolicy> | null | undefined
): AllocationPolicy {
  const base = DEFAULT_ALLOCATION_POLICY;
  if (!input) return { ...base, buckets: base.buckets.map((b) => ({ ...b, tickers: [...b.tickers] })) };

  const buckets = base.buckets.map((b) => {
    const override = input.buckets?.find((x) => x.id === b.id);
    const tickers =
      override?.tickers
        ?.map(normalizeTicker)
        .filter(Boolean) ?? [...b.tickers];
    const targetWeight = isValidWeight(override?.targetWeight)
      ? override!.targetWeight
      : b.targetWeight;
    return {
      ...b,
      label: override?.label?.trim() || b.label,
      targetWeight,
      tickers: tickers.length ? tickers : [...b.tickers],
    };
  });

  // Renormalize targets if they don't sum to ~1 (keep relative, or leave as-is if zero)
  const sum = buckets.reduce((s, b) => s + b.targetWeight, 0);
  if (sum > 0 && Math.abs(sum - 1) > 0.001) {
    for (const b of buckets) {
      b.targetWeight = round4(b.targetWeight / sum);
    }
  }

  return {
    buckets,
    offPolicyLabel: input.offPolicyLabel?.trim() || base.offPolicyLabel,
    concentrationThreshold: isValidWeight(input.concentrationThreshold)
      ? input.concentrationThreshold
      : base.concentrationThreshold,
    extremeConcentrationThreshold: isValidWeight(
      input.extremeConcentrationThreshold
    )
      ? input.extremeConcentrationThreshold
      : base.extremeConcentrationThreshold,
  };
}

export function loadLocalAllocationPolicy(): AllocationPolicy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AllocationPolicy>;
    return normalizeAllocationPolicy(parsed);
  } catch {
    return null;
  }
}

export function saveLocalAllocationPolicy(policy: AllocationPolicy): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeAllocationPolicy(policy);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("wealthspace:allocation-policy-saved"));
}

export function clearLocalAllocationPolicy(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("wealthspace:allocation-policy-saved"));
}

export function resolveAllocationPolicy(
  localOverride?: AllocationPolicy | null
): AllocationPolicy {
  return normalizeAllocationPolicy(localOverride ?? null);
}

export { STORAGE_KEY as TARGET_ALLOCATION_STORAGE_KEY };
