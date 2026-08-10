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
  ACCOUNT_TYPE_OPTIONS,
  createEmptyAccountRow,
  loadLocalAccounts,
  parseAccountsPaste,
  saveLocalAccounts,
  type AccountRow,
  type AccountTypeOption,
} from "@/lib/accounts-sheet";
import {
  getAccountsForEditor,
  saveAccountsBatch,
} from "@/lib/actions/accounts";
import { getDataModeMeta } from "@/lib/actions/demo-mode";
import { PLACEHOLDER_ACCOUNTS } from "@/lib/placeholder-data";
import { cn } from "@/lib/utils";

type Props = {
  initialRows?: AccountRow[];
};

function toEditorRows(rows: AccountRow[]): AccountRow[] {
  return rows.map((r) => ({ ...r }));
}

export function AccountsSpreadsheet({ initialRows = [] }: Props) {
  const [rows, setRows] = useState<AccountRow[]>(() =>
    initialRows.length ? toEditorRows(initialRows) : []
  );
  const [history, setHistory] = useState<AccountRow[][]>([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [remote, modeMeta] = await Promise.all([
        getAccountsForEditor(),
        getDataModeMeta(),
      ]);
      if (cancelled) return;

      if (remote.fromDb && remote.rows.length) {
        setRows(toEditorRows(remote.rows));
      } else {
        const local = loadLocalAccounts();
        if (local?.length) {
          setRows(toEditorRows(local));
          setStatus("Loaded accounts saved in this browser.");
        } else if (initialRows.length) {
          setRows(toEditorRows(initialRows));
        } else if (modeMeta.preference === "personal") {
          setRows([createEmptyAccountRow()]);
          setStatus(
            modeMeta.databaseConfigured
              ? "Personal ledger — add your first account and Save."
              : "Personal ledger (local) — add your first account. Set DATABASE_URL to persist in Postgres."
          );
        } else {
          setRows(
            PLACEHOLDER_ACCOUNTS.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type as AccountTypeOption,
              balance: a.balance,
              currency: a.currency,
              notes: "",
              lastUpdated: a.lastUpdated,
              persisted: false,
            }))
          );
          setStatus("Starter demo rows loaded — edit and Save.");
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRows]);

  const pushHistory = useCallback((current: AccountRow[]) => {
    setHistory((h) => [...h.slice(-19), current.map((r) => ({ ...r }))]);
  }, []);

  const updateRow = useCallback(
    (id: string, patch: Partial<AccountRow>) => {
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

  const addRow = () => {
    setRows((prev) => {
      pushHistory(prev);
      return [...prev, createEmptyAccountRow()];
    });
    setDirty(true);
  };

  const duplicateRow = (id: string) => {
    setRows((prev) => {
      pushHistory(prev);
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const copy: AccountRow = {
        ...prev[idx],
        id: `local_${crypto.randomUUID()}`,
        name: prev[idx].name ? `${prev[idx].name} (copy)` : "",
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
    // Only intercept multi-cell paste
    if (!text.includes("\n") && !text.includes("\t")) return;
    e.preventDefault();
    const parsed = parseAccountsPaste(text);
    if (!parsed.length) return;
    setRows((prev) => {
      pushHistory(prev);
      const mapped = parsed.map((p) => ({
        ...createEmptyAccountRow(),
        ...p,
        name: p.name || "",
        type: p.type || "CASH",
        balance: p.balance ?? 0,
        currency: p.currency || "USD",
        notes: p.notes || "",
      }));
      return [...prev, ...mapped];
    });
    setDirty(true);
    setStatus(`Pasted ${parsed.length} row(s) from spreadsheet.`);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const row of rows) {
      if (!row.name.trim()) {
        next[row.id] = "Name required";
      } else if (!Number.isFinite(Number(row.balance))) {
        next[row.id] = "Balance must be a number";
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
      const result = await saveAccountsBatch(rows);
      if (!result.success) {
        setStatus(result.message);
        return;
      }
      const savedRows = result.rows ?? rows;
      if (result.mode === "local") {
        saveLocalAccounts(savedRows);
      } else {
        saveLocalAccounts(savedRows);
      }
      setRows(toEditorRows(savedRows));
      setDirty(false);
      setHistory([]);
      setStatus(result.message);
    });
  };

  const loadTemplate = () => {
    setRows((prev) => {
      pushHistory(prev);
      return PLACEHOLDER_ACCOUNTS.map((a) => ({
        id: `local_${crypto.randomUUID()}`,
        name: a.name,
        type: a.type as AccountTypeOption,
        balance: a.balance,
        currency: a.currency,
        notes: "",
        lastUpdated: new Date().toISOString(),
        persisted: false,
      }));
    });
    setDirty(true);
    setStatus("Loaded sample accounts template.");
  };

  const totals = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.balance) || 0), 0),
    [rows]
  );

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Loading accounts…
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
            Accounts spreadsheet
          </CardTitle>
          <CardDescription className="mt-2 max-w-2xl">
            Edit bank, brokerage, crypto, and property balances like a sheet.
            Click a cell, use Tab / Enter, paste from Google Sheets or Excel.
            CSV bulk import stays on{" "}
            <Link href="/upload" className="underline underline-offset-2">
              Data Ingestion
            </Link>
            .
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={!history.length}>
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={loadTemplate}>
            Sample template
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Add row
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={isPending || !dirty}>
            <Save className="h-4 w-4" />
            {isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3" onPaste={onPaste}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {dirty ? "Unsaved changes" : "All changes saved"} · {rows.length}{" "}
            row(s) · Σ {totals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-muted/80 px-3 py-2 font-medium backdrop-blur">
                  Account
                </th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">CCY</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-border hover:bg-muted/30",
                    errors[row.id] && "bg-destructive/5"
                  )}
                >
                  <td className="sticky left-0 z-10 bg-card/95 px-2 py-1.5 backdrop-blur">
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      className="h-9 border-transparent bg-transparent px-2 shadow-none focus-visible:border-input focus-visible:bg-background"
                      placeholder="Account name"
                      aria-invalid={Boolean(errors[row.id])}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select
                      value={row.type}
                      onValueChange={(v) =>
                        updateRow(row.id, { type: v as AccountTypeOption })
                      }
                    >
                      <SelectTrigger className="h-9 border-transparent bg-transparent shadow-none focus:ring-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      value={Number.isFinite(row.balance) ? row.balance : 0}
                      onChange={(e) =>
                        updateRow(row.id, { balance: Number(e.target.value) })
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
                  <td className="px-2 py-1.5">
                    <Input
                      value={row.notes}
                      onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                      className="h-9 border-transparent bg-transparent px-2 shadow-none focus-visible:border-input focus-visible:bg-background"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
                    {row.lastUpdated
                      ? new Date(row.lastUpdated).toLocaleDateString()
                      : "—"}
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
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No accounts yet. Add a row or load the sample template.
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
