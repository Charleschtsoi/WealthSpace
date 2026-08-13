"use client";

import { useEffect, useState } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { MvpBanner } from "@/components/MvpBanner";
import { ReconciliationBanner } from "@/components/ReconciliationBanner";
import { readLocalDashboardOverride } from "@/lib/dashboard-local";
import type {
  PlaceholderHolding,
  PlaceholderSnapshot,
} from "@/lib/placeholder-data";
import type { ReconciliationIssue } from "@/lib/valuation";

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
  reconciliationIssues: ReconciliationIssue[];
  usingPlaceholderData: boolean;
  /** When false, parent already renders DataModeBanner. Default true. */
  showMvpBanner?: boolean;
  /** When false, parent already renders ReconciliationBanner. Default true. */
  showReconciliationBanner?: boolean;
};

export function DashboardClient({
  metrics: serverMetrics,
  snapshots,
  holdings: serverHoldings,
  reconciliationIssues: serverIssues,
  usingPlaceholderData,
  showMvpBanner = true,
  showReconciliationBanner = true,
}: Props) {
  const [metrics, setMetrics] = useState(serverMetrics);
  const [holdings, setHoldings] = useState(serverHoldings);
  const [issues, setIssues] = useState(serverIssues);
  const [usingLocalLedger, setUsingLocalLedger] = useState(false);

  useEffect(() => {
    const applyLocal = () => {
      // Prefer browser ledger when demo/placeholder mode, or whenever local
      // saves exist (demo path without DATABASE_URL).
      const local = readLocalDashboardOverride();
      if (!local) {
        setMetrics(serverMetrics);
        setHoldings(serverHoldings);
        setIssues(serverIssues);
        setUsingLocalLedger(false);
        return;
      }
      if (!usingPlaceholderData && !local.accounts.length) {
        // Live DB path without local accounts — keep server holdings unless
        // local holdings were edited.
        if (!local.holdings.length) {
          setMetrics(serverMetrics);
          setHoldings(serverHoldings);
          setIssues(serverIssues);
          setUsingLocalLedger(false);
          return;
        }
      }
      setMetrics(local.metrics);
      setHoldings(local.holdings.length ? local.holdings : serverHoldings);
      setIssues(local.reconciliationIssues);
      setUsingLocalLedger(true);
    };

    applyLocal();
    window.addEventListener("wealthspace:ledger-saved", applyLocal);
    window.addEventListener("storage", applyLocal);
    return () => {
      window.removeEventListener("wealthspace:ledger-saved", applyLocal);
      window.removeEventListener("storage", applyLocal);
    };
  }, [serverHoldings, serverIssues, serverMetrics, usingPlaceholderData]);

  return (
    <>
      {showMvpBanner && (
        <MvpBanner
          usingPlaceholderData={usingPlaceholderData || usingLocalLedger}
        />
      )}

      {showReconciliationBanner && <ReconciliationBanner issues={issues} />}

      {usingLocalLedger && (
        <p className="animate-fade-up rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing metrics from your saved Money workspace ledger in this
          browser.
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

      <HoldingsTable holdings={holdings} />
    </>
  );
}
