"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Save,
  Trash2,
  Copy,
  FileSpreadsheet,
  Undo2,
  Upload,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmptyHoldingRow,
  loadLocalHoldings,
  marketValue,
  parseHoldingsPaste,
  saveLocalHoldings,
  type HoldingAccountOption,
  type HoldingRow,
} from "@/lib/holdings-sheet";
import { loadLocalAccounts } from "@/lib/accounts-sheet";
import {
  getAccountOptionsForHoldings,
  getHoldingsForEditor,
  saveHoldingsBatch,
} from "@/lib/actions/holdings";
import { PLACEHOLDER_HOLDINGS } from "@/lib/placeholder-data";
import { cn, formatCurrency } from "@/lib/utils";

function toEditorRows(rows: HoldingRow[]): HoldingRow[] {
  return rows.map((r) => ({ ...r }));
}

function mergeAccountOptions(
  remote: HoldingAccountOption[],
  localNames: string[]
): HoldingAccountOption[] {
  const map = new Map<string, HoldingAccountOption>();
  for (const a of remote) {
    map.set(a.id, a);
  }
  for (const name of localNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const existing = Array.from(map.values()).find(
      (a) => a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (!existing) {
      const id = `local_acc_${trimmed.toLowerCase().replace(/\s+/g, "_")}`;
      map.set(id, { id, name: trimmed });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function HoldingsSpreadsheet() {
  const [rows, setRows] = useState<HoldingRow[]>([]);
  const [accounts, setAccounts] = useState<HoldingAccountOption[]>([]);
  const [history, setHistory] = useState<HoldingRow[][]>([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [remoteHoldings, remoteAccounts] = await Promise.all([
        getHoldingsForEditor(),
        getAccountOptionsForHoldings(),
      ]);
      if (cancelled) return;

      const localAccounts = loadLocalAccounts();
      const localAccountNames = localAccounts?.map((a) => a.name) ?? [];
      const accountOptions = mergeAccountOptions(
        remoteAccounts.accounts,
        localAccountNames
      );
      setAccounts(accountOptions);

      const defaultAccount = accountOptions[0] ?? null;

      if (remoteHoldings.fromDb && remoteHoldings.rows.length) {
        setRows(toEditorRows(remoteHoldings.rows));
      } else {
        const local = loadLocalHoldings();
        if (local?.length) {
          setRows(toEditorRows(local));
          setStatus("Loaded holdings saved in this browser.");
        } else {
          setRows(
            PLACEHOLDER_HOLDINGS.map((h) => ({
              id: h.id,
              ticker: h.ticker,
              accountId: h.accountId,
              accountName: h.accountName ?? defaultAccount?.name ?? "",
              quantity: h.quantity,
              averagePrice: h.averagePrice,
              currentPrice: h.currentPrice,
              currency: h.currency,
              persisted: false,
            }))
          );
          setStatus("Starter demo positions loaded — edit and Save.");
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushHistory = useCallback((current: HoldingRow[]) => {
    setHistory((h) => [...h.slice(-19), current.map((r) => ({ ...r }))]);
  }, []);

  const updateRow = useCallback(
    (id: string, patch: Partial<HoldingRow>) => {
      setRows((prev) => {
        pushHistory(prev);
        return prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      });
      setDirty(true);
      setErrors((e) => {
        const next = { ...e };
        delete next[id];
        return next;
      });
    },
    [pushHistory]
  );

  const setAccountForRow = (id: string, accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    updateRow(id, {
      accountId,
      accountName: account?.name ?? "",
    });
  };

  const addRow = () => {
    setRows((prev) => {
      pushHistory(prev);
      return [...prev, createEmptyHoldingRow(accounts[0] ?? null)];
    });
    setDirty(true);
  };

  const duplicateRow = (id: string) => {
    setRows((prev) => {
      pushHistory(prev);
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const copy: HoldingRow = {
        ...prev[idx],
        id: `local_${crypto.randomUUID()}`,
        ticker: prev[idx].ticker ? `${prev[idx].ticker}` : "",
        persisted: false,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setDirty(true);
  };

  const deleteRow = (id: string) => {
    setRows((prev) => {
      pushHistory(prev);
      return prev.filter((r) => r.id !== id);
    });
    setDirty(true);
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setRows(prev);
      setDirty(true);
      return h.slice(0, -1);
    });
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const parsed = parseHoldingsPaste(text, accounts);
    if (!parsed.length) return;
    setRows((prev) => {
      pushHistory(prev);
      const mapped = parsed.map((p) => ({
        ...createEmptyHoldingRow(accounts[0] ?? null),
        ...p,
        ticker: p.ticker || "",
        accountId: p.accountId || accounts[0]?.id || "",
        accountName: p.accountName || accounts[0]?.name || "",
        quantity: p.quantity ?? 0,
        averagePrice: p.averagePrice ?? 0,
        currentPrice: p.currentPrice ?? 0,
        currency: p.currency || "USD",
      }));
      return [...prev, ...mapped];
    });
    setDirty(true);
    setStatus(`Pasted ${parsed.length} row(s) from spreadsheet.`);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const row of rows) {
      if (!row.ticker.trim()) {
        next[row.id] = "Ticker required";
      } else if (!row.accountId && !row.accountName) {
        next[row.id] = "Account required";
      } else if (
        !Number.isFinite(Number(row.quantity)) ||
        !Number.isFinite(Number(row.averagePrice)) ||
        !Number.isFinite(Number(row.currentPrice))
      ) {
        next[row.id] = "Qty and prices must be numbers";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = () => {
    if (!validate()) {
      setStatus("Fix highlighted rows before saving.");
      return;
    }
    startTransition(async () => {
      const result = await saveHoldingsBatch(rows);
      if (!result.success) {
        setStatus(result.message);
        return;
      }
      const savedRows = result.rows ?? rows;
      saveLocalHoldings(savedRows);
      setRows(toEditorRows(savedRows));
      setDirty(false);
      setHistory([]);
      setStatus(result.message);
    });
  };

  const loadTemplate = () => {
    setRows((prev) => {
      pushHistory(prev);
      return PLACEHOLDER_HOLDINGS.map((h) => ({
        id: `local_${crypto.randomUUID()}`,
        ticker: h.ticker,
        accountId: h.accountId,
        accountName: h.accountName ?? accounts[0]?.name ?? "",
        quantity: h.quantity,
        averagePrice: h.averagePrice,
        currentPrice: h.currentPrice,
        currency: h.currency,
        persisted: false,
      }));
    });
    setDirty(true);
    setStatus("Loaded sample holdings template.");
  };

  const totals = useMemo(
    () => rows.reduce((sum, r) => sum + marketValue(r), 0),
    [rows]
  );

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Loading holdings…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Holdings spreadsheet
          </CardTitle>
          <CardDescription className="mt-2 max-w-2xl">
            Edit tickers, quantities, and prices like a sheet. Market value
            updates as you type. Link each row to an{" "}
            <Link href="/accounts" className="underline underline-offset-2">
              account
            </Link>
            . Paste from Google Sheets or Excel; CSV bulk import stays on{" "}
            <Link href="/upload" className="underline underline-offset-2">
              Data Ingestion
            </Link>
            .
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!history.length}
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Coming in WS-12 — live/delayed quote refresh"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh prices
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={loadTemplate}>
            Sample template
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Add row
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={isPending || !dirty}
          >
            <Save className="h-4 w-4" />
            {isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3" onPaste={onPaste}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {dirty ? "Unsaved changes" : "All changes saved"} · {rows.length}{" "}
            row(s) · Σ{" "}
            {formatCurrency(totals, "USD", { maximumFractionDigits: 0 })}
          </span>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV instead
          </Link>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-muted/80 px-3 py-2 font-medium backdrop-blur">
                  Ticker
                </th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Avg price</th>
                <th className="px-3 py-2 font-medium text-right">Current price</th>
                <th className="px-3 py-2 font-medium">CCY</th>
                <th className="px-3 py-2 font-medium text-right">Market value</th>
                <th className="px-3 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const mv = marketValue(row);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-t border-border hover:bg-muted/30",
                      errors[row.id] && "bg-destructive/5"
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-card/95 px-2 py-1.5 backdrop-blur">
                      <Input
                        value={row.ticker}
                        onChange={(e) =>
                          updateRow(row.id, {
                            ticker: e.target.value.toUpperCase(),
                          })
                        }
                        className="h-9 border-transparent bg-transparent px-2 font-medium uppercase shadow-none focus-visible:border-input focus-visible:bg-background"
                        placeholder="VOO"
                        aria-invalid={Boolean(errors[row.id])}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select
                        value={row.accountId || undefined}
                        onValueChange={(v) => setAccountForRow(row.id, v)}
                      >
                        <SelectTrigger className="h-9 min-w-[140px] border-transparent bg-transparent shadow-none focus:ring-1">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="any"
                        value={Number.isFinite(row.quantity) ? row.quantity : 0}
                        onChange={(e) =>
                          updateRow(row.id, { quantity: Number(e.target.value) })
                        }
                        className="h-9 border-transparent bg-transparent px-2 text-right tabular-nums shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={
                          Number.isFinite(row.averagePrice) ? row.averagePrice : 0
                        }
                        onChange={(e) =>
                          updateRow(row.id, {
                            averagePrice: Number(e.target.value),
                          })
                        }
                        className="h-9 border-transparent bg-transparent px-2 text-right tabular-nums shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={
                          Number.isFinite(row.currentPrice) ? row.currentPrice : 0
                        }
                        onChange={(e) =>
                          updateRow(row.id, {
                            currentPrice: Number(e.target.value),
                          })
                        }
                        className="h-9 border-transparent bg-transparent px-2 text-right tabular-nums shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={row.currency}
                        maxLength={3}
                        onChange={(e) =>
                          updateRow(row.id, {
                            currency: e.target.value.toUpperCase(),
                          })
                        }
                        className="h-9 w-16 border-transparent bg-transparent px-2 uppercase shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(mv, row.currency || "USD")}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => duplicateRow(row.id)}
                          aria-label="Duplicate row"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteRow(row.id)}
                          aria-label="Delete row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No holdings yet. Add a row or load the sample template.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {Object.keys(errors).length > 0 && (
          <p className="text-sm text-destructive">
            Some rows need attention before save.
          </p>
        )}

        {status && (
          <p
            className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
            role="status"
          >
            {status}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
