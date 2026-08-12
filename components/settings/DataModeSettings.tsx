"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, FlaskConical, Loader2, UserRound } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  loadSamplePortfolio,
  startPersonalLedger,
} from "@/lib/actions/demo-mode";
import { clearLocalAccounts } from "@/lib/accounts-sheet";
import { clearLocalHoldings } from "@/lib/holdings-sheet";
import type { DataMode } from "@/lib/demo-mode";

type Props = {
  preference: DataMode;
  databaseConfigured: boolean;
};

export function DataModeSettings({
  preference,
  databaseConfigured,
}: Props) {
  const router = useRouter();
  const [hint, setHint] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="font-display text-xl">Demo → live path</CardTitle>
        <CardDescription>
          Choose whether WealthSpace shows the sample portfolio or your personal
          ledger. Persistence needs{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">DATABASE_URL</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
            {preference === "personal" ? (
              <>
                <UserRound className="h-3.5 w-3.5" /> Personal
              </>
            ) : (
              <>
                <FlaskConical className="h-3.5 w-3.5" /> Demo
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            {databaseConfigured
              ? "Postgres configured"
              : "DATABASE_URL not set — local/browser saves only"}
          </span>
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Click <strong className="text-foreground">Start with my data</strong>{" "}
            to clear sample confusion and open empty editable sheets.
          </li>
          <li>
            Add accounts on{" "}
            <Link href="/money?tab=accounts" className="underline underline-offset-2">
              Accounts
            </Link>
            , then holdings on{" "}
            <Link href="/money?tab=holdings" className="underline underline-offset-2">
              Holdings
            </Link>
            .
          </li>
          <li>
            For Vercel: set <code className="text-xs">DATABASE_URL</code>, redeploy,
            run <code className="text-xs">npx prisma db push</code> (and optionally{" "}
            <code className="text-xs">npm run db:seed</code> for the sample).
          </li>
          <li>
            Use <strong className="text-foreground">Load sample portfolio</strong>{" "}
            anytime to explore the demo UI again.
          </li>
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={isPending || preference === "personal"}
            onClick={() => {
              startTransition(async () => {
                clearLocalAccounts();
                clearLocalHoldings();
                await startPersonalLedger();
                setHint("Personal ledger mode on — open Accounts to add your first row.");
                router.refresh();
              });
            }}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
            Start with my data
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || preference === "demo"}
            onClick={() => {
              startTransition(async () => {
                clearLocalAccounts();
                clearLocalHoldings();
                const result = await loadSamplePortfolio();
                setHint(result.seedHint);
                router.refresh();
              });
            }}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            Load sample portfolio
          </Button>
        </div>

        {hint && <p className="text-xs text-foreground/80">{hint}</p>}
      </CardContent>
    </Card>
  );
}
