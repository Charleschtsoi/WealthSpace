"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  FlaskConical,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadSamplePortfolio,
  startPersonalLedger,
} from "@/lib/actions/demo-mode";
import { clearLocalAccounts } from "@/lib/accounts-sheet";
import { clearLocalHoldings } from "@/lib/holdings-sheet";
import type { DataMode } from "@/lib/demo-mode";
import { cn } from "@/lib/utils";

type Props = {
  preference: DataMode;
  usingDemoData: boolean;
  isLive: boolean;
  databaseConfigured: boolean;
  className?: string;
};

export function DataModeBanner({
  preference,
  usingDemoData,
  isLive,
  databaseConfigured,
  className,
}: Props) {
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const modeLabel = isLive ? "Live" : usingDemoData ? "Demo" : "Personal";
  const ModeIcon = isLive ? Database : usingDemoData ? FlaskConical : UserRound;

  function onStartPersonal() {
    startTransition(async () => {
      clearLocalAccounts();
      clearLocalHoldings();
      const result = await startPersonalLedger();
      setHint(
        result.databaseConfigured
          ? "Personal ledger ready — add your first account on Accounts."
          : "Personal mode on. Sheets start empty. Add DATABASE_URL in Settings/Vercel to persist, or keep editing locally in this browser."
      );
      router.refresh();
      router.push("/money?tab=accounts");
    });
  }

  function onLoadSample() {
    startTransition(async () => {
      clearLocalAccounts();
      clearLocalHoldings();
      const result = await loadSamplePortfolio();
      setHint(result.seedHint);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "animate-fade-up rounded-md border px-4 py-4 text-sm",
        isLive
          ? "border-emerald-600/25 bg-emerald-500/5"
          : usingDemoData
            ? "border-amber-600/30 bg-amber-500/5"
            : "border-primary/25 bg-primary/5",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em]",
                isLive
                  ? "bg-emerald-600/15 text-emerald-800"
                  : usingDemoData
                    ? "bg-amber-600/15 text-amber-900"
                    : "bg-primary/15 text-primary"
              )}
            >
              <ModeIcon className="h-3.5 w-3.5" />
              {modeLabel} data
            </span>
            <span className="text-xs text-muted-foreground">
              Preference: {preference === "personal" ? "Personal ledger" : "Sample portfolio"}
              {databaseConfigured ? " · Postgres connected" : " · No DATABASE_URL"}
            </span>
          </div>

          {isLive ? (
            <p className="text-muted-foreground">
              Dashboard is reading accounts, holdings, and snapshots from your
              database. Spreadsheet edits save to Postgres.
            </p>
          ) : usingDemoData ? (
            <p className="text-muted-foreground">
              You are viewing the built-in sample portfolio — not your personal
              wealth. Start a clean ledger, or keep exploring the demo.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Personal mode is on with an empty ledger. Create your first account
              to begin, then add holdings. Without{" "}
              <Link href="/settings" className="underline underline-offset-2">
                DATABASE_URL
              </Link>
              , saves stay in this browser until Postgres is configured.
            </p>
          )}

          {hint && <p className="text-xs text-foreground/80">{hint}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!isLive && usingDemoData && (
            <Button
              size="sm"
              onClick={onStartPersonal}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRound className="h-4 w-4" />
              )}
              Start with my data
            </Button>
          )}
          {!usingDemoData && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLoadSample}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Load sample portfolio
            </Button>
          )}
          {usingDemoData && (
            <Button size="sm" variant="outline" asChild>
              <Link href="/money?tab=accounts">Open accounts</Link>
            </Button>
          )}
          {!databaseConfigured && (
            <Button size="sm" variant="ghost" asChild>
              <Link href="/settings">DB / AI setup</Link>
            </Button>
          )}
          {isLive && preference !== "demo" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onLoadSample}
              disabled={isPending}
            >
              Explore sample UI
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use DataModeBanner */
export function MvpBanner({
  usingPlaceholderData,
}: {
  usingPlaceholderData: boolean;
}) {
  return (
    <DataModeBanner
      preference={usingPlaceholderData ? "demo" : "personal"}
      usingDemoData={usingPlaceholderData}
      isLive={!usingPlaceholderData}
      databaseConfigured={!usingPlaceholderData}
    />
  );
}
