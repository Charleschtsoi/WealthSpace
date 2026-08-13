"use client";

import { useEffect, useState } from "react";
import { ReconciliationBanner } from "@/components/ReconciliationBanner";
import { readLocalDashboardOverride } from "@/lib/dashboard-local";
import type { ReconciliationIssue } from "@/lib/valuation";

type Props = {
  serverIssues: ReconciliationIssue[];
};

/**
 * Prefers browser ledger reconciliation when local sheets exist;
 * otherwise shows the server-computed issues from getDashboardData.
 */
export function MoneyReconciliation({ serverIssues }: Props) {
  const [issues, setIssues] = useState(serverIssues);

  useEffect(() => {
    const apply = () => {
      const local = readLocalDashboardOverride();
      if (local?.accounts.length || local?.holdings.length) {
        setIssues(local.reconciliationIssues);
        return;
      }
      setIssues(serverIssues);
    };
    apply();
    window.addEventListener("wealthspace:ledger-saved", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("wealthspace:ledger-saved", apply);
      window.removeEventListener("storage", apply);
    };
  }, [serverIssues]);

  return <ReconciliationBanner issues={issues} />;
}
