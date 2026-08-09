"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Save,
  Trash2,
  Copy,
  FileSpreadsheet,
  Undo2,
  Upload,
  Download,
  RotateCcw,
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
  TRANSACTION_TYPE_OPTIONS,
  createEmptyTransactionRow,
  loadLocalTransactions,
  parseTransactionsPaste,
  saveLocalTransactions,
  type TransactionAccountOption,
  type TransactionRow,
  type TransactionTypeOption,
} from "@/lib/transactions-sheet";
import { loadLocalAccounts } from "@/lib/accounts-sheet";
import {
  getAccountOptionsForTransactions,
  getTransactionsForEditor,
  saveTransactionsBatch,
} from "@/lib/actions/transactions";
import { PLACEHOLDER_TRANSACTIONS } from "@/lib/placeholder-data";
import { recordMoneyActivity } from "@/lib/money-activity";
import { notifyLedgerSaved } from "@/lib/dashboard-local";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  /** Compact chrome when rendered inside Money workspace */
  embedded?: boolean;
};

function toEditorRows(rows: TransactionRow[]): TransactionRow[] {
  return rows.map((r) => ({ ...r }));
}

function cloneRows(rows: TransactionRow[]): TransactionRow[] {
  return rows.map((r) => ({ ...r }));
}

function mergeAccountOptions(
  remote: TransactionAccountOption[],
  localNames: Array<{ name: string; currency?: string }>
): TransactionAccountOption[] {
  const map = new Map<string, TransactionAccountOption>();
  for (const a of remote) {
    map.set(a.id, a);
  }
  for (const item of localNames) {
    const trimmed = item.name.trim();
    if (!trimmed) continue;
    const existing = Array.from(map.values()).find(
      (a) => a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (!existing) {
      const id = `local_acc_${trimmed.toLowerCase().replace(/\s+/g, "_")}`;
      map.set(id, { id, name: trimmed, currency: item.currency ?? "USD" });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function downloadTransactionsTemplate() {
  const header = "Date,Account,Type,Amount,Currency,Description";
  const sample = PLACEHOLDER_TRANSACTIONS.map(
    (t) =>
      `${t.date},${t.accountName},${t.type},${t.amount},${t.currency},${t.description}`
  ).join("\n");
  const blob = new Blob([`${header}\n${sample}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wealthspace-transactions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function TransactionsSpreadsheet({ embedded = false }: Props) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<TransactionAccountOption[]>([]);
  const [history, setHistory] = useState<TransactionRow[][]>([]);
  const [baseline, setBaseline] = useState<TransactionRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const dirtyRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});

  const markDirty = useCallback(() => {
    setDirty(true);
    dirtyRef.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [remoteTxns, remoteAccounts] = await Promise.all([
        getTransactionsForEditor(),
        getAccountOptionsForTransactions(),
      ]);
      if (cancelled) return;

      const localAccounts = loadLocalAccounts();
      const localAccountNames =
        localAccounts?.map((a) => ({ name: a.name, currency: a.currency })) ??
        [];
      const accountOptions = mergeAccountOptions(
        remoteAccounts.accounts,
        localAccountNames
      );
      setAccounts(accountOptions);

      const defaultAccount = accountOptions[0] ?? null;

      if (remoteTxns.fromDb && remoteTxns.rows.length) {
        const next = toEditorRows(remoteTxns.rows);
        setRows(next);
        setBaseline(cloneRows(next));
      } else {
        const local = loadLocalTransactions();
        if (local?.length) {
          const next = toEditorRows(local);
          setRows(next);
          setBaseline(cloneRows(next));
          setStatus("Loaded transactions saved in this browser.");
        } else {
          const next = PLACEHOLDER_TRANSACTIONS.map((t) => ({
            id: t.id,
            date: t.date,
            accountId: t.accountId,
            accountName: t.accountName ?? defaultAccount?.name ?? "",
            type: t.type,
            amount: t.amount,
            currency: t.currency,
            description: t.description,
            persisted: false,
          }));
          setRows(next);
          setBaseline(cloneRows(next));
          setStatus("Starter demo transactions loaded — edit and Save.");
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushHistory = useCallback((current: TransactionRow[]) => {
    setHistory((h) => [...h.slice(-19), current.map((r) => ({ ...r }))]);
  }, []);

  const updateRow = useCallback(
    (id: string, patch: Partial<TransactionRow>) => {
      setRows((prev) => {
        pushHistory(prev);
        return prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      });
      markDirty();
      setErrors((e) => {
        const next = { ...e };
        delete next[id];
        return next;
      });
    },
    [pushHistory, markDirty]
  );

  const setAccountForRow = (id: string, accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    updateRow(id, {
      accountId,
      accountName: account?.name ?? "",
      currency: account?.currency ?? "USD",
    });
  };

  const addRow = () => {
    setRows((prev) => {
      pushHistory(prev);
      return [...prev, createEmptyTransactionRow(accounts[0] ?? null)];
    });
    markDirty();
  };

  const duplicateRow = (id: string) => {
    setRows((prev) => {
      pushHistory(prev);
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const copy: TransactionRow = {
        ...prev[idx],
        id: `local_${crypto.randomUUID()}`,
        persisted: false,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    markDirty();
  };

  const deleteRow = (id: string) => {
    setRows((prev) => {
      pushHistory(prev);
      return prev.filter((r) => r.id !== id);
    });
    markDirty();
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setRows(prev);
      markDirty();
      return h.slice(0, -1);
    });
  };

  const discard = () => {
    setRows(cloneRows(baseline));
    setHistory([]);
    setErrors({});
    setDirty(false);
    dirtyRef.current = false;
    setStatus("Discarded unsaved changes.");
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const parsed = parseTransactionsPaste(text, accounts);
    if (!parsed.length) return;
    setRows((prev) => {
      pushHistory(prev);
      const mapped = parsed.map((p) => ({
        ...createEmptyTransactionRow(accounts[0] ?? null),
        ...p,
        date: p.date || new Date().toISOString().slice(0, 10),
        accountId: p.accountId || accounts[0]?.id || "",
        accountName: p.accountName || accounts[0]?.name || "",
        type: p.type || "DEPOSIT",
        amount: p.amount ?? 0,
        currency: p.currency || accounts[0]?.currency || "USD",
        description: p.description || "",
      }));
      return [...mapped, ...prev];
    });
    markDirty();
    setStatus(`Pasted ${parsed.length} row(s) from spreadsheet.`);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    const accountIds = new Set(accounts.map((a) => a.id));
    const accountNames = new Set(
      accounts.map((a) => a.name.trim().toLowerCase())
    );

    for (const row of rows) {
      if (!row.date.trim() || Number.isNaN(new Date(row.date).getTime())) {
        next[row.id] = "Valid date required";
      } else if (!row.accountId && !row.accountName.trim()) {
        next[row.id] = "Account required";
      } else if (
        row.accountId &&
        !accountIds.has(row.accountId) &&
        !accountNames.has(row.accountName.trim().toLowerCase())
      ) {
        next[row.id] = "Unknown account";
      } else if (!Number.isFinite(Number(row.amount)) || Number(row.amount) < 0) {
        next[row.id] = "Amount must be ≥ 0";
      } else if (!/^[A-Za-z]{3}$/.test(row.currency.trim())) {
        next[row.id] = "Currency must be 3 letters";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = useCallback(() => {
    if (!validate()) {
      setStatus("Fix highlighted rows before saving.");
      return;
    }
    startTransition(async () => {
      const result = await saveTransactionsBatch(rows);
      if (!result.success) {
        setStatus(result.message);
        return;
      }
      const savedRows = result.rows ?? rows;
      saveLocalTransactions(savedRows);
      setRows(toEditorRows(savedRows));
      setBaseline(cloneRows(savedRows));
      setDirty(false);
      dirtyRef.current = false;
      setHistory([]);
      setStatus(result.message);
      recordMoneyActivity(
        "transactions_save",
        `Saved ${savedRows.length} transaction(s)`,
        result.mode === "local" ? "Browser storage" : "Database"
      );
      notifyLedgerSaved();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  saveRef.current = onSave;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current) saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadTemplate = () => {
    setRows((prev) => {
      pushHistory(prev);
      return PLACEHOLDER_TRANSACTIONS.map((t) => ({
        id: `local_${crypto.randomUUID()}`,
        date: t.date,
        accountId: t.accountId,
        accountName: t.accountName ?? accounts[0]?.name ?? "",
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        persisted: false,
      }));
    });
    markDirty();
    setStatus("Loaded sample transactions template.");
  };

  const totals = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows]
  );

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Loading transactions…
        </CardContent>
      </Card>
    );
  }

  const toolbar = (
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
        onClick={discard}
        disabled={!dirty || isPending}
      >
        <RotateCcw className="h-4 w-4" />
        Discard
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={downloadTransactionsTemplate}
      >
        <Download className="h-4 w-4" />
        Download template
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={loadTemplate}>
        Sample rows
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add row
      </Button>
      {!embedded && (
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/money?tab=import">
            <Upload className="h-4 w-4" />
            Import CSV
          </Link>
        </Button>
      )}
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
  );

  return (
    <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Transactions spreadsheet
          </CardTitle>
          {!embedded && (
            <CardDescription className="mt-2 max-w-2xl">
              Edit deposits, withdrawals, buys, and sells like a sheet. Prefer
              the{" "}
              <Link
                href="/money?tab=transactions"
                className="underline underline-offset-2"
              >
                Money workspace
              </Link>
              .
            </CardDescription>
          )}
          {embedded && (
            <CardDescription className="mt-2 max-w-2xl">
              Daily correction surface for cashflow history. Paste from Sheets.{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
                ⌘/Ctrl+S
              </kbd>{" "}
              saves.
            </CardDescription>
          )}
        </div>
        {toolbar}
      </CardHeader>
      <CardContent className="space-y-3" onPaste={onPaste}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium",
              dirty
                ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            )}
            role="status"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                dirty ? "bg-amber-500" : "bg-emerald-500"
              )}
            />
            {dirty ? "Unsaved changes" : "All changes saved"}
            <span className="font-normal text-muted-foreground">
              · {rows.length} row(s) · Σ{" "}
              {formatCurrency(totals, "USD", { maximumFractionDigits: 0 })}
            </span>
          </span>
          {embedded && (
            <Link
              href="/money?tab=import"
              className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Link>
          )}
        </div>

        {!accounts.length && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            No accounts found. Create accounts on the{" "}
            <Link
              href="/money?tab=accounts"
              className="underline underline-offset-2"
            >
              Accounts
            </Link>{" "}
            tab before saving transactions to the database.
          </p>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-muted/80 px-3 py-2 font-medium backdrop-blur">
                  Date
                </th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">CCY</th>
                <th className="px-3 py-2 font-medium">Description</th>
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
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        updateRow(row.id, { date: e.target.value })
                      }
                      className="h-9 border-transparent bg-transparent px-2 shadow-none focus-visible:border-input focus-visible:bg-background"
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
                    <Select
                      value={row.type}
                      onValueChange={(v) =>
                        updateRow(row.id, {
                          type: v as TransactionTypeOption,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 min-w-[120px] border-transparent bg-transparent shadow-none focus:ring-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSACTION_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={Number.isFinite(row.amount) ? row.amount : 0}
                      onChange={(e) =>
                        updateRow(row.id, { amount: Number(e.target.value) })
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
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.id, { description: e.target.value })
                      }
                      className="h-9 border-transparent bg-transparent px-2 shadow-none focus-visible:border-input focus-visible:bg-background"
                      placeholder="Optional note"
                    />
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
                    No transactions yet. Add a row, paste from Sheets, or load
                    sample rows. CSV bulk import stays on Import.
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
