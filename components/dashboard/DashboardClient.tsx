"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { TargetDriftPanel } from "@/components/dashboard/TargetDriftPanel";
import { MvpBanner } from "@/components/MvpBanner";
import { readLocalDashboardOverride } from "@/lib/dashboard-local";
import {
  computeTargetAllocation,
  loadLocalAllocationPolicy,
  resolveAllocationPolicy,
  type TargetAllocationReport,
} from "@/lib/target-allocation";
import type {
  PlaceholderHolding,
  PlaceholderSnapshot,
} from "@/lib/placeholder-data";

type Metrics = {
  totalNetWorth: number;
  liquidCash: number;
  totalInvested: number;
  allocation: { name: string; value: number; fill: string }[];
};

type Props = {
  metrics: Metrics;
  snapshots: PlaceholderSnapshot[];
  holdings: PlaceholderHolding[];
  targetAllocation: TargetAllocationReport;
  usingPlaceholderData: boolean;
  /** When false, parent already renders DataModeBanner. Default true. */
  showMvpBanner?: boolean;
};

export function DashboardClient({
  metrics: serverMetrics,
  snapshots,
  holdings: serverHoldings,
  targetAllocation: serverTargetAllocation,
  usingPlaceholderData,
  showMvpBanner = true,
}: Props) {
  const [metrics, setMetrics] = useState(serverMetrics);
  const [holdings, setHoldings] = useState(serverHoldings);
  const [targetAllocation, setTargetAllocation] = useState(
    serverTargetAllocation
  );
  const [usingLocalLedger, setUsingLocalLedger] = useState(false);
  const [usingCustomPolicy, setUsingCustomPolicy] = useState(false);

  useEffect(() => {
    const applyLocal = () => {
      const savedPolicy = loadLocalAllocationPolicy();
      const policy = resolveAllocationPolicy(savedPolicy);
      setUsingCustomPolicy(Boolean(savedPolicy));

      const local = readLocalDashboardOverride();

      if (!local) {
        setMetrics(serverMetrics);
        setHoldings(serverHoldings);
        setTargetAllocation(
          computeTargetAllocation(serverHoldings, policy)
        );
        setUsingLocalLedger(false);
        return;
      }

      const nextHoldings = local.holdings.length
        ? local.holdings
        : serverHoldings;
      const nextMetrics =
        local.accounts.length || local.holdings.length
          ? local.metrics
          : serverMetrics;

      if (!usingPlaceholderData && !local.accounts.length) {
        if (!local.holdings.length) {
          // Policy-only local override (or empty) — keep server metrics/holdings
          setMetrics(serverMetrics);
          setHoldings(serverHoldings);
          setTargetAllocation(
            computeTargetAllocation(serverHoldings, policy)
          );
          setUsingLocalLedger(Boolean(savedPolicy));
          return;
        }
      }

      setMetrics(nextMetrics);
      setHoldings(nextHoldings);
      setTargetAllocation(
        local.holdings.length
          ? local.targetAllocation
          : computeTargetAllocation(nextHoldings, policy)
      );
      setUsingLocalLedger(true);
    };

    applyLocal();
    window.addEventListener("wealthspace:ledger-saved", applyLocal);
    window.addEventListener("wealthspace:allocation-policy-saved", applyLocal);
    window.addEventListener("storage", applyLocal);
    return () => {
      window.removeEventListener("wealthspace:ledger-saved", applyLocal);
      window.removeEventListener(
        "wealthspace:allocation-policy-saved",
        applyLocal
      );
      window.removeEventListener("storage", applyLocal);
    };
  }, [
    serverHoldings,
    serverMetrics,
    serverTargetAllocation,
    usingPlaceholderData,
  ]);

  return (
    <>
      {showMvpBanner && (
        <MvpBanner
          usingPlaceholderData={usingPlaceholderData || usingLocalLedger}
        />
      )}

      {usingLocalLedger && (
        <p className="animate-fade-up rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing metrics from your saved Money workspace ledger
          {usingCustomPolicy ? " and allocation policy" : ""} in this browser.
        </p>
      )}

      <SummaryCards
        totalNetWorth={metrics.totalNetWorth}
        liquidCash={metrics.liquidCash}
        totalInvested={metrics.totalInvested}
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <NetWorthChart data={snapshots} />
        </div>
        <div className="xl:col-span-2">
          <AllocationChart data={metrics.allocation} />
        </div>
      </div>

      <TargetDriftPanel report={targetAllocation} />

      <HoldingsTable holdings={holdings} />
    </>
  );
}
