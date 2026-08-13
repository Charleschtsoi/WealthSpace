"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { ReconciliationIssue } from "@/lib/valuation";
import { cn } from "@/lib/utils";

type Props = {
  issues: ReconciliationIssue[];
  className?: string;
};

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ReconciliationBanner({ issues, className }: Props) {
  if (!issues.length) return null;

  return (
    <div
      className={cn(
        "animate-fade-up rounded-md border border-amber-600/35 bg-amber-500/5 px-4 py-4 text-sm",
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-600/15 text-amber-900">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
              Ledger reconciliation
            </p>
            <p className="text-muted-foreground">
              {issues.length === 1
                ? "One account balance disagrees with its holdings market value."
                : `${issues.length} account balances disagree with holdings market value.`}{" "}
              Net worth uses holdings when lots exist (balance is ignored to
              avoid double-counting) — update the fields below so they agree.
            </p>
          </div>

          <ul className="space-y-3">
            {issues.map((issue) => (
              <li
                key={`${issue.accountId}-${issue.code}`}
                className="rounded-md border border-amber-600/20 bg-background/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-amber-600/15 px-2 py-0.5 text-xs font-semibold text-amber-950">
                    Mismatch
                  </span>
                  <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    {issue.accountType}
                  </span>
                  <span className="font-medium text-foreground">
                    {issue.accountName}
                  </span>
                </div>
                <p className="mt-1.5 text-muted-foreground">{issue.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stated {formatMoney(issue.statedBalance)} · Holdings{" "}
                  {formatMoney(issue.computedHoldingsMv)} · Δ{" "}
                  {formatMoney(issue.delta)}. {issue.fixHint}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Link
                    href={issue.links.accounts}
                    className="font-medium text-amber-950 underline underline-offset-2"
                  >
                    Edit accounts
                  </Link>
                  <Link
                    href={issue.links.holdings}
                    className="font-medium text-amber-950 underline underline-offset-2"
                  >
                    Edit holdings
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
