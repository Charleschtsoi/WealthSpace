export type TransactionTypeOption =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "BUY"
  | "SELL";

export type TransactionRow = {
  /** Client row id — may be a cuid from DB or a temporary local id */
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  type: TransactionTypeOption;
  amount: number;
  currency: string;
  description: string;
  /** True when this row existed in DB (vs local-only) */
  persisted?: boolean;
};

export type TransactionAccountOption = {
  id: string;
  name: string;
  currency?: string;
};

const STORAGE_KEY = "wealthspace.transactions.v1";

export const TRANSACTION_TYPE_OPTIONS: TransactionTypeOption[] = [
  "DEPOSIT",
  "WITHDRAWAL",
  "BUY",
  "SELL",
];

export function createEmptyTransactionRow(
  account?: TransactionAccountOption | null
): TransactionRow {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `local_${crypto.randomUUID()}`,
    date: today,
    accountId: account?.id ?? "",
    accountName: account?.name ?? "",
    type: "DEPOSIT",
    amount: 0,
    currency: account?.currency ?? "USD",
    description: "",
    persisted: false,
  };
}

export function loadLocalTransactions(): TransactionRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TransactionRow[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalTransactions(rows: TransactionRow[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function clearLocalTransactions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function parseType(raw: string): TransactionTypeOption {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (TRANSACTION_TYPE_OPTIONS.includes(normalized as TransactionTypeOption)) {
    return normalized as TransactionTypeOption;
  }
  const lower = raw.trim().toLowerCase();
  if (lower.includes("buy")) return "BUY";
  if (lower.includes("sell")) return "SELL";
  if (lower.includes("withdraw")) return "WITHDRAWAL";
  if (lower.includes("deposit") || lower.includes("salary")) return "DEPOSIT";
  return "DEPOSIT";
}

/**
 * Parse TSV/CSV paste from Sheets/Excel.
 * Expected columns: Date, Account, Type, Amount, Currency, Description
 */
export function parseTransactionsPaste(
  text: string,
  accounts: TransactionAccountOption[]
): Partial<TransactionRow>[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const split = (line: string) =>
    line.includes("\t") ? line.split("\t") : line.split(",");

  let start = 0;
  const first = split(lines[0]).map((c) => c.trim().toLowerCase());
  if (first[0] === "date" || first[0] === "txn date") {
    start = 1;
  }

  const byName = new Map(
    accounts.map((a) => [a.name.trim().toLowerCase(), a])
  );

  const rows: Partial<TransactionRow>[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = split(lines[i]).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (!cols[0] && !cols[1]) continue;

    const dateRaw = cols[0] || "";
    const parsedDate = dateRaw ? new Date(dateRaw) : null;
    const date =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().slice(0, 10)
        : dateRaw.slice(0, 10);

    const accountName = cols[1] || "";
    const matched = byName.get(accountName.trim().toLowerCase());
    const amount = Number(String(cols[3] ?? "0").replace(/[$,]/g, ""));

    rows.push({
      date,
      accountId: matched?.id ?? "",
      accountName: matched?.name ?? accountName,
      type: parseType(cols[2] || "DEPOSIT"),
      amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
      currency: (cols[4] || matched?.currency || "USD").toUpperCase().slice(0, 3),
      description: cols[5] || "",
    });
  }
  return rows;
}
