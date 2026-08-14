/**
 * CSV statement import planner (WS-02).
 *
 * Pure helpers so preview, Postgres ingest, and localStorage demo mode share
 * the same type / holdings / balance / duplicate rules.
 */

export type CsvTxnType = "DEPOSIT" | "WITHDRAWAL" | "BUY" | "SELL";

export type CsvRawRow = {
  Date: string;
  Account: string;
  "Ticker/Description": string;
  Amount: string;
  Currency: string;
  Quantity?: string;
  Price?: string;
};

export type CsvImportPreviewRow = {
  date: string;
  accountName: string;
  description: string;
  amountRaw: string;
  amount: number;
  currency: string;
  type: CsvTxnType;
  ticker: string | null;
  quantity: number | null;
  price: number | null;
  balanceDelta: number;
  holdingAction: "create" | "increase" | "decrease" | "none";
  warning: string | null;
  fingerprint: string;
  isDuplicate: boolean;
};

export type HoldingLotState = {
  accountName: string;
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency: string;
};

export type HoldingMutation = {
  accountName: string;
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency: string;
  /** True when quantity reaches ~0 after a sell — caller should delete the lot */
  remove: boolean;
};

export type PlannedCsvImport = {
  preview: CsvImportPreviewRow[];
  toImport: CsvImportPreviewRow[];
  duplicates: CsvImportPreviewRow[];
  invalid: Array<{ row: CsvRawRow; error: string }>;
};

const TICKER_RE = /[A-Z][A-Z0-9.\-]{0,11}/;

export function parseCsvAmount(raw: string): number {
  const cleaned = String(raw ?? "").replace(/[$,\s]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return value;
}

export function parseCsvDate(raw: string): Date {
  const date = new Date(String(raw ?? "").trim());
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${raw}`);
  }
  return date;
}

export function formatCsvDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function inferAccountTypeFromName(
  name: string
): "CASH" | "BROKERAGE" | "CRYPTO" | "REAL_ESTATE" {
  const lower = name.toLowerCase();
  if (
    lower.includes("property") ||
    lower.includes("real estate") ||
    lower.includes("home")
  ) {
    return "REAL_ESTATE";
  }
  if (
    lower.includes("crypto") ||
    lower.includes("binance") ||
    lower.includes("coinbase") ||
    lower.includes("okx")
  ) {
    return "CRYPTO";
  }
  if (
    lower.includes("cash") ||
    lower.includes("bank") ||
    lower.includes("hang seng") ||
    lower.includes("checking") ||
    lower.includes("savings")
  ) {
    return "CASH";
  }
  return "BROKERAGE";
}

export function inferTransactionType(
  description: string,
  amount: number
): CsvTxnType {
  const lower = description.toLowerCase();
  if (/\bbuy\b/.test(lower) || lower.startsWith("b ")) return "BUY";
  if (/\bsell\b/.test(lower) || lower.startsWith("s ")) return "SELL";
  if (/\bwithdraw/.test(lower) || /\brent\b/.test(lower)) return "WITHDRAWAL";
  if (
    /\bdeposit\b/.test(lower) ||
    /\bsalary\b/.test(lower) ||
    /\bpayout\b/.test(lower)
  ) {
    return "DEPOSIT";
  }
  if (amount >= 0) return "DEPOSIT";
  return "WITHDRAWAL";
}

/**
 * Extract ticker / qty / price hints from free-text descriptions such as:
 * - BUY VOO
 * - BUY VOO 4.73
 * - BUY 4.73 VOO
 * - SELL AAPL 8 @ 225
 * - SELL META trim
 */
export function parseTradeDescription(description: string): {
  ticker: string | null;
  quantity: number | null;
  price: number | null;
} {
  const text = description.trim();
  if (!text) return { ticker: null, quantity: null, price: null };

  const upper = text.toUpperCase();
  const sideMatch = upper.match(/^\s*(BUY|SELL|B|S)\b/);
  if (!sideMatch) {
    // Non-trade description — try bare ticker token only when clearly symbol-like
    const bare = upper.match(new RegExp(`\\b(${TICKER_RE.source})\\b`));
    return { ticker: bare ? bare[1] : null, quantity: null, price: null };
  }

  const rest = upper.slice(sideMatch[0].length).trim();

  // BUY 4.73 VOO [@ price]
  let m = rest.match(
    new RegExp(
      `^(\\d+(?:\\.\\d+)?)\\s+(${TICKER_RE.source})(?:\\s*@\\s*(\\d+(?:\\.\\d+)?))?`
    )
  );
  if (m) {
    return {
      ticker: m[2],
      quantity: Number(m[1]),
      price: m[3] ? Number(m[3]) : null,
    };
  }

  // BUY VOO 4.73 [@ price]
  m = rest.match(
    new RegExp(
      `^(${TICKER_RE.source})(?:\\s+(\\d+(?:\\.\\d+)?))?(?:\\s*@\\s*(\\d+(?:\\.\\d+)?))?`
    )
  );
  if (m) {
    return {
      ticker: m[1],
      quantity: m[2] ? Number(m[2]) : null,
      price: m[3] ? Number(m[3]) : null,
    };
  }

  return { ticker: null, quantity: null, price: null };
}

export function balanceDeltaForType(type: CsvTxnType, amount: number): number {
  const abs = Math.abs(amount);
  switch (type) {
    case "DEPOSIT":
      return abs;
    case "WITHDRAWAL":
      return -abs;
    case "BUY":
      return -abs;
    case "SELL":
      return abs;
    default:
      return 0;
  }
}

export function importFingerprint(input: {
  date: string;
  accountName: string;
  type: CsvTxnType;
  amount: number;
  description: string;
}): string {
  const amount = Math.abs(Number(input.amount));
  const rounded = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
  return [
    input.date.trim(),
    input.accountName.trim().toLowerCase(),
    input.type,
    rounded,
    input.description.trim().toLowerCase(),
  ].join("|");
}

function optionalNumber(raw: string | undefined): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function enrichCsvRow(
  row: CsvRawRow,
  existingFingerprints: Set<string>
): CsvImportPreviewRow | { error: string; row: CsvRawRow } {
  try {
    const accountName = row.Account?.trim();
    if (!accountName) {
      return { error: "Missing Account", row };
    }
    const description = row["Ticker/Description"]?.trim() || "Imported";
    const amount = parseCsvAmount(row.Amount);
    const date = formatCsvDateKey(parseCsvDate(row.Date));
    const currency = (row.Currency?.trim() || "USD").toUpperCase().slice(0, 3);
    const type = inferTransactionType(description, amount);
    const parsed = parseTradeDescription(description);

    let quantity =
      optionalNumber(row.Quantity) ??
      (parsed.quantity != null && Number.isFinite(parsed.quantity)
        ? parsed.quantity
        : null);
    let price =
      optionalNumber(row.Price) ??
      (parsed.price != null && Number.isFinite(parsed.price)
        ? parsed.price
        : null);

    const absAmount = Math.abs(amount);
    if (
      (type === "BUY" || type === "SELL") &&
      quantity == null &&
      price != null &&
      price > 0
    ) {
      quantity = absAmount / price;
    }
    if (
      (type === "BUY" || type === "SELL") &&
      price == null &&
      quantity != null &&
      quantity > 0
    ) {
      price = absAmount / quantity;
    }

    let warning: string | null = null;
    let holdingAction: CsvImportPreviewRow["holdingAction"] = "none";
    const resolvedTicker =
      type === "BUY" || type === "SELL" ? parsed.ticker : null;

    if (type === "BUY" || type === "SELL") {
      if (!resolvedTicker) {
        warning =
          "BUY/SELL needs a ticker in Description (e.g. BUY VOO 4.73). Holding not updated.";
      } else if (
        quantity == null ||
        quantity <= 0 ||
        price == null ||
        price <= 0
      ) {
        warning =
          "Add Quantity (or qty in description) so holdings can update. Transaction still imports.";
      } else {
        holdingAction = type === "BUY" ? "increase" : "decrease";
      }
    }

    const fingerprint = importFingerprint({
      date,
      accountName,
      type,
      amount: absAmount,
      description,
    });

    return {
      date,
      accountName,
      description,
      amountRaw: row.Amount,
      amount: absAmount,
      currency,
      type,
      ticker: resolvedTicker,
      quantity:
        holdingAction === "none"
          ? quantity
          : quantity != null && quantity > 0
            ? quantity
            : null,
      price:
        holdingAction === "none"
          ? price
          : price != null && price > 0
            ? price
            : null,
      balanceDelta: balanceDeltaForType(type, amount),
      holdingAction,
      warning,
      fingerprint,
      isDuplicate: existingFingerprints.has(fingerprint),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid row",
      row,
    };
  }
}

export function planCsvImport(
  rows: CsvRawRow[],
  existingFingerprints: Iterable<string> = []
): PlannedCsvImport {
  const known = new Set(
    Array.from(existingFingerprints).map((f) => f.trim()).filter(Boolean)
  );
  const preview: CsvImportPreviewRow[] = [];
  const invalid: PlannedCsvImport["invalid"] = [];
  // Within-file duplicates: second occurrence is also flagged
  const seenInFile = new Set<string>();

  for (const row of rows) {
    const result = enrichCsvRow(row, known);
    if ("error" in result) {
      invalid.push({ row: result.row, error: result.error });
      continue;
    }
    if (seenInFile.has(result.fingerprint)) {
      result.isDuplicate = true;
      result.warning = result.warning
        ? `${result.warning} Duplicate of an earlier row in this file.`
        : "Duplicate of an earlier row in this file — will be skipped.";
    } else {
      seenInFile.add(result.fingerprint);
      if (result.isDuplicate) {
        result.warning = result.warning
          ? `${result.warning} Already imported — will be skipped.`
          : "Already imported — will be skipped on re-import.";
      }
    }
    preview.push(result);
  }

  return {
    preview,
    toImport: preview.filter((r) => !r.isDuplicate),
    duplicates: preview.filter((r) => r.isDuplicate),
    invalid,
  };
}

/** Weighted-average BUY / quantity-reducing SELL against an in-memory lot map. */
export function applyHoldingTrade(
  lots: Map<string, HoldingLotState>,
  trade: {
    accountName: string;
    ticker: string;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    currency: string;
  }
): HoldingMutation | null {
  const ticker = trade.ticker.trim().toUpperCase();
  const accountName = trade.accountName.trim();
  if (!ticker || !accountName) return null;
  if (!(trade.quantity > 0) || !(trade.price > 0)) return null;

  const key = `${accountName.toLowerCase()}|${ticker}`;
  const existing = lots.get(key);

  if (trade.type === "BUY") {
    if (!existing) {
      const created: HoldingLotState = {
        accountName,
        ticker,
        quantity: trade.quantity,
        averagePrice: trade.price,
        currentPrice: trade.price,
        currency: trade.currency,
      };
      lots.set(key, created);
      return { ...created, remove: false };
    }
    const newQty = existing.quantity + trade.quantity;
    const newAvg =
      newQty > 0
        ? (existing.quantity * existing.averagePrice +
            trade.quantity * trade.price) /
          newQty
        : trade.price;
    const updated: HoldingLotState = {
      ...existing,
      quantity: newQty,
      averagePrice: roundPrice(newAvg),
      currentPrice: trade.price,
      currency: trade.currency || existing.currency,
    };
    lots.set(key, updated);
    return { ...updated, remove: false };
  }

  // SELL
  if (!existing) {
    return null;
  }
  const newQty = Math.max(0, existing.quantity - trade.quantity);
  if (newQty < 1e-8) {
    lots.delete(key);
    return {
      ...existing,
      quantity: 0,
      remove: true,
    };
  }
  const updated: HoldingLotState = {
    ...existing,
    quantity: newQty,
    // Keep cost basis on remaining shares
    averagePrice: existing.averagePrice,
    currentPrice: trade.price,
  };
  lots.set(key, updated);
  return { ...updated, remove: false };
}

function roundPrice(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function fingerprintsFromTransactions(
  rows: Array<{
    date: string;
    accountName: string;
    type: string;
    amount: number;
    description?: string | null;
  }>
): string[] {
  return rows.map((r) =>
    importFingerprint({
      date: r.date.slice(0, 10),
      accountName: r.accountName,
      type: (r.type as CsvTxnType) || "DEPOSIT",
      amount: Math.abs(Number(r.amount) || 0),
      description: r.description ?? "",
    })
  );
}

export const CSV_IMPORT_TEMPLATE = `Date,Account,Ticker/Description,Amount,Currency,Quantity
2026-08-01,Firstrade,BUY VOO,2500,USD,4.73
2026-08-02,Hang Seng,Salary deposit,12000,USD,
2026-08-03,Firstrade,SELL AAPL,-1827.2,USD,8
2026-08-04,Hang Seng,Rent withdrawal,-3200,USD,`;

export const DB_UNAVAILABLE_IMPORT_HINT =
  "DATABASE_URL is not configured. Import will save to this browser’s local ledger (Accounts / Holdings / Transactions). Add a Postgres URL in Vercel (or .env) to persist server-side.";
