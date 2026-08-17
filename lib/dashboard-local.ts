import { loadLocalAccounts } from "@/lib/accounts-sheet";
import { loadLocalHoldings, marketValue } from "@/lib/holdings-sheet";
import {
  computeDashboardMetrics,
  type PlaceholderAccount,
  type PlaceholderHolding,
} from "@/lib/placeholder-data";
import {
  computeTargetAllocation,
  loadLocalAllocationPolicy,
  resolveAllocationPolicy,
  type TargetAllocationReport,
} from "@/lib/target-allocation";

/** Notify listeners (dashboard) that ledger data changed in this browser. */
export function notifyLedgerSaved(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wealthspace:ledger-saved"));
}

function policyForClient() {
  return resolveAllocationPolicy(loadLocalAllocationPolicy());
}

export function readLocalDashboardOverride(): {
  accounts: PlaceholderAccount[];
  holdings: PlaceholderHolding[];
  metrics: ReturnType<typeof computeDashboardMetrics>;
  targetAllocation: TargetAllocationReport;
} | null {
  if (typeof window === "undefined") return null;

  const localAccounts = loadLocalAccounts();
  const localHoldings = loadLocalHoldings();
  const localPolicy = loadLocalAllocationPolicy();
  if (!localAccounts?.length && !localHoldings?.length && !localPolicy) {
    return null;
  }

  const accounts: PlaceholderAccount[] = (localAccounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: Number(a.balance) || 0,
    currency: a.currency || "USD",
    lastUpdated: a.lastUpdated || new Date().toISOString(),
  }));

  const holdings: PlaceholderHolding[] = (localHoldings ?? []).map((h) => ({
    id: h.id,
    accountId: h.accountId,
    ticker: h.ticker,
    quantity: Number(h.quantity) || 0,
    averagePrice: Number(h.averagePrice) || 0,
    currentPrice: Number(h.currentPrice) || 0,
    currency: h.currency || "USD",
    accountName: h.accountName,
  }));

  const policy = policyForClient();

  // Prefer local accounts; if only holdings exist, keep empty cash/property from none
  const metrics = computeDashboardMetrics(
    accounts.length ? accounts : [],
    holdings
  );
  const targetAllocation = computeTargetAllocation(holdings, policy);

  // If we only have holdings locally, still surface equity MV in invested
  if (!accounts.length && holdings.length) {
    const equities = holdings.reduce((sum, h) => sum + marketValue(h), 0);
    return {
      accounts,
      holdings,
      targetAllocation,
      metrics: {
        ...metrics,
        totalInvested: equities,
        totalNetWorth: equities,
        allocation: [
          { name: "Cash", value: 0, fill: "var(--chart-cash)" },
          { name: "Equities", value: equities, fill: "var(--chart-equities)" },
          { name: "Property", value: 0, fill: "var(--chart-property)" },
        ],
      },
    };
  }

  // Policy-only override (no local ledger): caller may merge onto server holdings
  if (!accounts.length && !holdings.length && localPolicy) {
    return {
      accounts: [],
      holdings: [],
      metrics,
      targetAllocation,
    };
  }

  return { accounts, holdings, metrics, targetAllocation };
}
