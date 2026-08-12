"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Table2,
  CandlestickChart,
  Upload,
  History,
  Keyboard,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountsSpreadsheet } from "@/components/accounts/AccountsSpreadsheet";
import { HoldingsSpreadsheet } from "@/components/holdings/HoldingsSpreadsheet";
import { TransactionsSpreadsheet } from "@/components/transactions/TransactionsSpreadsheet";
import { DataUploader } from "@/components/DataUploader";
import { MoneyHistory } from "@/components/money/MoneyHistory";

export type MoneyTab =
  | "accounts"
  | "holdings"
  | "transactions"
  | "import"
  | "history";

const TABS: {
  id: MoneyTab;
  label: string;
  icon: typeof Table2;
  description: string;
}[] = [
  {
    id: "accounts",
    label: "Accounts",
    icon: Table2,
    description: "Balances by account",
  },
  {
    id: "holdings",
    label: "Holdings",
    icon: CandlestickChart,
    description: "Positions & prices",
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
    description: "Cashflow ledger",
  },
  {
    id: "import",
    label: "Import",
    icon: Upload,
    description: "CSV & manual entry",
  },
  {
    id: "history",
    label: "History",
    icon: History,
    description: "Recent saves",
  },
];

function parseTab(value: string | null): MoneyTab {
  if (
    value === "holdings" ||
    value === "transactions" ||
    value === "import" ||
    value === "history"
  ) {
    return value;
  }
  return "accounts";
}

export function MoneyWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(
    () => parseTab(searchParams.get("tab")),
    [searchParams]
  );

  const setTab = useCallback(
    (next: MoneyTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "accounts") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div
          role="tablist"
          aria-label="Money workspace sections"
          className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2 rounded-md border border-border/80 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          <Keyboard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p>
            <span className="font-medium text-foreground">Shortcuts: </span>
            Tab / Shift+Tab move cells · Enter commits a cell ·{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ⌘/Ctrl+S
            </kbd>{" "}
            saves the active sheet · Undo reverts the last edit
          </p>
        </div>
      </div>

      <div role="tabpanel" className="min-h-[320px]">
        {tab === "accounts" && <AccountsSpreadsheet embedded />}
        {tab === "holdings" && <HoldingsSpreadsheet embedded />}
        {tab === "transactions" && <TransactionsSpreadsheet embedded />}
        {tab === "import" && <DataUploader embedded />}
        {tab === "history" && <MoneyHistory />}
      </div>
    </div>
  );
}
