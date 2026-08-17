"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { TargetAllocationReport } from "@/lib/target-allocation";
import { AlertTriangle, Target } from "lucide-react";
import Link from "next/link";

type Props = {
  report: TargetAllocationReport;
};

function pct(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}

function signedDollars(value: number): string {
  const abs = formatCurrency(Math.abs(value));
  if (value > 0.5) return `+${abs}`;
  if (value < -0.5) return `−${abs}`;
  return abs;
}

function driftTone(driftWeight: number): string {
  if (Math.abs(driftWeight) < 0.02) return "text-muted-foreground";
  return driftWeight > 0
    ? "text-amber-700 dark:text-amber-400"
    : "text-sky-700 dark:text-sky-400";
}

export function TargetDriftPanel({ report }: Props) {
  const equity = report.equityMarketValue;
  const policyBuckets = report.buckets.filter((b) => b.id !== "offPolicy");
  const offPolicy = report.buckets.find((b) => b.id === "offPolicy");

  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur [animation-delay:280ms]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-display text-xl">
            Target vs actual
          </CardTitle>
          <CardDescription>
            Equity book {formatCurrency(equity)} · policy{" "}
            {policyBuckets
              .map((b) => `${Math.round(b.targetWeight * 100)}% ${b.label.toLowerCase()}`)
              .join(" / ")}
            .{" "}
            <Link
              href="/settings#allocation-policy"
              className="underline-offset-2 hover:underline"
            >
              Edit policy
            </Link>
          </CardDescription>
        </div>
        <div className="rounded-md bg-muted p-2 text-primary">
          <Target className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {equity <= 0 ? (
          <p className="text-sm text-muted-foreground">
            Add holdings in Money to see allocation drift against your target
            policy.
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {policyBuckets.map((bucket) => (
                <li key={bucket.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{bucket.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {pct(bucket.actualWeight)} actual ·{" "}
                      {pct(bucket.targetWeight)} target
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-sm bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/35"
                      style={{
                        width: `${Math.min(100, bucket.targetWeight * 100)}%`,
                      }}
                      title={`Target ${pct(bucket.targetWeight)}`}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-primary"
                      style={{
                        width: `${Math.min(100, bucket.actualWeight * 100)}%`,
                      }}
                      title={`Actual ${pct(bucket.actualWeight)}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {bucket.tickers.length
                        ? bucket.tickers.join(", ")
                        : "No holdings in sleeve"}
                    </span>
                    <span className={`tabular-nums font-medium ${driftTone(bucket.driftWeight)}`}>
                      Drift {signedDollars(bucket.driftDollars)} (
                      {bucket.driftWeight >= 0 ? "+" : ""}
                      {(bucket.driftWeight * 100).toFixed(1)} pp)
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {offPolicy && offPolicy.marketValue > 0 && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{offPolicy.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {pct(offPolicy.actualWeight)} ·{" "}
                    {formatCurrency(offPolicy.marketValue)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.offPolicyTickers.join(", ")} — not in the 80/20
                  preferred lists (target 0%).
                </p>
              </div>
            )}

            {report.concentration.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Concentration
                </p>
                <ul className="space-y-2">
                  {report.concentration.map((alert) => (
                    <li
                      key={`${alert.ticker}-${alert.reason}`}
                      className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                    >
                      <span className="font-medium">{alert.ticker}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {pct(alert.weight)} ·{" "}
                        {formatCurrency(alert.marketValue)}
                      </span>
                      <p className="mt-0.5 text-xs opacity-90">{alert.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
