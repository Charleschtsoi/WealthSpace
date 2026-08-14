"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, CircleDollarSign, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ingestCsvTransactions,
  updateAccountBalance,
} from "@/lib/actions/upload";
import {
  applyCsvImportLocally,
  previewCsvRows,
} from "@/lib/csv-import-local";
import {
  CSV_IMPORT_TEMPLATE,
  type CsvRawRow,
} from "@/lib/csv-import";
import { recordMoneyActivity } from "@/lib/money-activity";
import { notifyLedgerSaved } from "@/lib/dashboard-local";
import { cn } from "@/lib/utils";

type AccountTypeOption = "CASH" | "BROKERAGE" | "CRYPTO" | "REAL_ESTATE";

type Props = {
  embedded?: boolean;
};

function downloadCsvTemplate() {
  const blob = new Blob([CSV_IMPORT_TEMPLATE + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wealthspace-transactions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function DataUploader({ embedded = false }: Props) {
  const [preview, setPreview] = useState<CsvRawRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "warn" | "error">("ok");
  const [isPending, startTransition] = useTransition();

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountTypeOption>("CASH");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("USD");

  const enriched = useMemo(() => previewCsvRows(preview), [preview]);

  const canImport = enriched.length > 0 && !isPending;

  const previewSummary = useMemo(() => {
    const accounts = new Set(enriched.map((r) => r.accountName)).size;
    const dups = enriched.filter((r) => r.isDuplicate).length;
    const buys = enriched.filter((r) => r.type === "BUY").length;
    const sells = enriched.filter((r) => r.type === "SELL").length;
    const parts = [
      `${enriched.length} rows`,
      `${accounts} accounts`,
      `${buys} buys`,
      `${sells} sells`,
    ];
    if (dups) parts.push(`${dups} duplicate(s)`);
    return parts.join(" · ");
  }, [enriched]);

  function handleFile(file: File) {
    setFileName(file.name);
    setStatus(null);
    Papa.parse<CsvRawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data || []).filter(
          (row) => row.Date && row.Account && row.Amount
        );
        setPreview(rows);
        if (!rows.length) {
          setStatusTone("error");
          setStatus(
            "No valid rows found. Expected columns: Date, Account, Ticker/Description, Amount, Currency (optional Quantity, Price)."
          );
        }
      },
      error: (err) => {
        setStatusTone("error");
        setStatus(`Parse error: ${err.message}`);
        setPreview([]);
      },
    });
  }

  function onImport() {
    startTransition(async () => {
      const count = preview.length;
      const result = await ingestCsvTransactions(preview);

      if (result.mode === "local" && result.localPlan) {
        const local = applyCsvImportLocally(preview);
        setStatusTone(local.success ? "ok" : "warn");
        setStatus(local.message);
        if (local.success) {
          setPreview([]);
          setFileName(null);
          recordMoneyActivity(
            "csv_import",
            `Imported ${local.imported} CSV row(s) locally`,
            fileName ?? "CSV upload"
          );
          notifyLedgerSaved();
        }
        return;
      }

      setStatusTone(result.success ? "ok" : "error");
      setStatus(result.message);
      if (result.success) {
        setPreview([]);
        setFileName(null);
        recordMoneyActivity(
          "csv_import",
          `Imported ${result.count ?? count} CSV row(s)`,
          fileName ?? "CSV upload"
        );
        notifyLedgerSaved();
      }
    });
  }

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateAccountBalance({
        accountName,
        accountType,
        balance: Number(balance),
        currency,
      });
      setStatusTone(result.success ? "ok" : "error");
      setStatus(result.message);
      if (result.success) {
        recordMoneyActivity(
          "manual_balance",
          `Updated balance for ${accountName}`,
          `${balance} ${currency}`
        );
        notifyLedgerSaved();
        setAccountName("");
        setBalance("");
      }
    });
  }

  function loadSample() {
    const parsed = Papa.parse<CsvRawRow>(CSV_IMPORT_TEMPLATE, {
      header: true,
      skipEmptyLines: true,
    });
    setPreview(parsed.data.filter((r) => r.Date && r.Account && r.Amount));
    setFileName("sample-transactions.csv");
    setStatus(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            CSV Upload
          </CardTitle>
          <CardDescription>
            Import statements with columns: Date, Account, Ticker/Description,
            Amount, Currency — optional Quantity / Price for holding fidelity.
            {embedded
              ? " Part of the Money workspace — BUY/SELL updates Holdings; DEPOSIT/WITHDRAWAL adjust balances."
              : " BUY/SELL rows update holdings; cash rows adjust account balances."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            htmlFor="csv-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {fileName ?? "Drop a CSV or click to browse"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bank / brokerage exports only — works offline in this browser
                when Postgres is unset
              </p>
            </div>
            <input
              id="csv-upload"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadCsvTemplate}>
              <Download className="h-4 w-4" />
              Download template
            </Button>
            <Button type="button" variant="outline" onClick={loadSample}>
              Load sample CSV
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost">
                  Column guide
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Expected CSV format</DialogTitle>
                  <DialogDescription>
                    Header row is required. Type is inferred before import
                    (BUY/SELL/DEPOSIT/WITHDRAWAL). Add Quantity (or{" "}
                    <code className="text-xs">BUY VOO 4.73</code> in the
                    description) so holdings update. Re-importing the same
                    Date+Account+Type+Amount+Description is skipped.
                  </DialogDescription>
                </DialogHeader>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{CSV_IMPORT_TEMPLATE}
                </pre>
              </DialogContent>
            </Dialog>
            <Button type="button" disabled={!canImport} onClick={onImport}>
              {isPending ? "Importing…" : "Import"}
            </Button>
          </div>

          {enriched.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Preview · {previewSummary}
              </p>
              <p className="text-xs text-muted-foreground">
                Inferred types shown below. Duplicate rows are highlighted and
                skipped on import.
              </p>
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Δ bal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enriched.slice(0, 30).map((row, idx) => (
                      <TableRow
                        key={`${row.fingerprint}-${idx}`}
                        className={cn(
                          row.isDuplicate && "bg-amber-500/10",
                          row.warning && !row.isDuplicate && "bg-muted/40"
                        )}
                      >
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.accountName}</TableCell>
                        <TableCell>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium tracking-wide">
                            {row.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.ticker ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {row.quantity != null ? row.quantity : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[10rem] truncate text-xs">
                            {row.description}
                          </div>
                          {row.warning && (
                            <div className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400">
                              {row.warning}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.amountRaw}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {row.balanceDelta > 0 ? "+" : ""}
                          {row.balanceDelta}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-up border-border/80 bg-card/80 backdrop-blur [animation-delay:120ms]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            Manual Balance Update
          </CardTitle>
          <CardDescription>
            Quick entry for cash, brokerage, or property account balances when
            a statement is not available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onManualSubmit}>
            <div className="space-y-2">
              <Label htmlFor="accountName">Account name</Label>
              <Input
                id="accountName"
                placeholder="e.g. Hang Seng, Firstrade, Property"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <Select
                value={accountType}
                onValueChange={(v) => setAccountType(v as AccountTypeOption)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BROKERAGE">Brokerage</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                  <SelectItem value="REAL_ESTATE">Real estate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="balance">Balance</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving…" : "Save balance"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {status && (
        <p
          className={cn(
            "lg:col-span-2 rounded-md border px-4 py-3 text-sm",
            statusTone === "ok" && "border-border bg-muted/40",
            statusTone === "warn" &&
              "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
            statusTone === "error" &&
              "border-destructive/40 bg-destructive/10 text-destructive"
          )}
          role="status"
        >
          {status}
        </p>
      )}
    </div>
  );
}
