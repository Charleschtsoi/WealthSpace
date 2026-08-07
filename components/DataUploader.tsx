"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, CircleDollarSign } from "lucide-react";
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

type PreviewRow = {
  Date: string;
  Account: string;
  "Ticker/Description": string;
  Amount: string;
  Currency: string;
};

type AccountTypeOption = "CASH" | "BROKERAGE" | "REAL_ESTATE";

const SAMPLE_CSV = `Date,Account,Ticker/Description,Amount,Currency
2026-08-01,Firstrade,BUY VOO,2500,USD
2026-08-02,Hang Seng,Salary deposit,12000,USD
2026-08-03,Firstrade,SELL AAPL,-1800,USD
2026-08-04,Hang Seng,Rent withdrawal,-3200,USD`;

export function DataUploader() {
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountTypeOption>("CASH");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("USD");

  const canImport = preview.length > 0 && !isPending;

  const previewSummary = useMemo(() => {
    const accounts = new Set(preview.map((r) => r.Account)).size;
    return `${preview.length} rows · ${accounts} accounts`;
  }, [preview]);

  function handleFile(file: File) {
    setFileName(file.name);
    setStatus(null);
    Papa.parse<PreviewRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data || []).filter(
          (row) => row.Date && row.Account && row.Amount
        );
        setPreview(rows);
        if (!rows.length) {
          setStatus("No valid rows found. Expected columns: Date, Account, Ticker/Description, Amount, Currency.");
        }
      },
      error: (err) => {
        setStatus(`Parse error: ${err.message}`);
        setPreview([]);
      },
    });
  }

  function onImport() {
    startTransition(async () => {
      const result = await ingestCsvTransactions(preview);
      setStatus(result.message);
      if (result.success) {
        setPreview([]);
        setFileName(null);
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
      setStatus(result.message);
      if (result.success) {
        setAccountName("");
        setBalance("");
      }
    });
  }

  function loadSample() {
    const parsed = Papa.parse<PreviewRow>(SAMPLE_CSV, {
      header: true,
      skipEmptyLines: true,
    });
    setPreview(parsed.data);
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
            Amount, Currency. Rows map to Account and Transaction records.
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
                Bank / brokerage exports only — no live API required
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
                    Header row is required. Amounts may be signed; negative
                    values are treated as withdrawals or sells when the
                    description does not specify otherwise.
                  </DialogDescription>
                </DialogHeader>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{SAMPLE_CSV}
                </pre>
              </DialogContent>
            </Dialog>
            <Button type="button" disabled={!canImport} onClick={onImport}>
              {isPending ? "Importing…" : "Import to database"}
            </Button>
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Preview · {previewSummary}
              </p>
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>CCY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 20).map((row, idx) => (
                      <TableRow key={`${row.Date}-${idx}`}>
                        <TableCell>{row.Date}</TableCell>
                        <TableCell>{row.Account}</TableCell>
                        <TableCell>{row["Ticker/Description"]}</TableCell>
                        <TableCell className="tabular-nums">{row.Amount}</TableCell>
                        <TableCell>{row.Currency}</TableCell>
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
          className="lg:col-span-2 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
          role="status"
        >
          {status}
        </p>
      )}
    </div>
  );
}
