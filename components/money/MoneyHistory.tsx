"use client";

import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  clearMoneyActivity,
  loadMoneyActivity,
  MONEY_ACTIVITY_LABELS,
  type MoneyActivity,
} from "@/lib/money-activity";

export function MoneyHistory() {
  const [items, setItems] = useState<MoneyActivity[]>([]);

  const refresh = () => setItems(loadMoneyActivity());

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("wealthspace:money-activity", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("wealthspace:money-activity", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <History className="h-5 w-5 text-primary" />
            Recent money activity
          </CardTitle>
          <CardDescription className="mt-2 max-w-2xl">
            Saves and imports from this browser — accounts, holdings,
            transactions, and CSV import.
          </CardDescription>
        </div>
        {items.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              clearMoneyActivity();
              refresh();
            }}
          >
            <Trash2 className="h-4 w-4" />
            Clear history
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No saves or imports yet. Edit Accounts, Holdings, or Transactions
            and Save, or use Import.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{item.summary}</p>
                  {item.detail && (
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5 font-medium uppercase tracking-wide">
                    {MONEY_ACTIVITY_LABELS[item.kind]}
                  </span>
                  <time dateTime={item.at} className="tabular-nums">
                    {new Date(item.at).toLocaleString()}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
