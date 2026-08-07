export type HoldingRow = {
  /** Client row id — may be a cuid from DB or a temporary local id */
  id: string;
  ticker: string;
  accountId: string;
  accountName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency: string;
  /** True when this row existed in DB (vs local-only) */
  persisted?: boolean;
};

export type HoldingAccountOption = {
  id: string;
  name: string;
};

const STORAGE_KEY = "wealthspace.holdings.v1";

export function marketValue(row: Pick<HoldingRow, "quantity" | "currentPrice">): number {
  const qty = Number(row.quantity);
  const price = Number(row.currentPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}

export function createEmptyHoldingRow(
  account?: HoldingAccountOption | null
): HoldingRow {
  return {
    id: `local_${crypto.randomUUID()}`,
    ticker: "",
    accountId: account?.id ?? "",
    accountName: account?.name ?? "",
    quantity: 0,
    averagePrice: 0,
    currentPrice: 0,
    currency: "USD",
    persisted: false,
  };
}

export function loadLocalHoldings(): HoldingRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HoldingRow[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalHoldings(rows: HoldingRow[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function clearLocalHoldings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Parse TSV/CSV paste from Sheets/Excel.
 * Expected columns: Ticker, Account, Qty, Avg price, Current price, Currency
 */
export function parseHoldingsPaste(
  text: string,
  accounts: HoldingAccountOption[]
): Partial<HoldingRow>[] {
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
  if (first[0] === "ticker" || first[0] === "symbol") {
    start = 1;
  }

  const byName = new Map(
    accounts.map((a) => [a.name.trim().toLowerCase(), a])
  );

  const rows: Partial<HoldingRow>[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = split(lines[i]).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (!cols[0]) continue;

    const ticker = cols[0].toUpperCase();
    const accountName = cols[1] || "";
    const matched = byName.get(accountName.trim().toLowerCase());
    const quantity = Number(String(cols[2] ?? "0").replace(/[$,]/g, ""));
    const averagePrice = Number(String(cols[3] ?? "0").replace(/[$,]/g, ""));
    const currentPrice = Number(String(cols[4] ?? "0").replace(/[$,]/g, ""));

    rows.push({
      ticker,
      accountId: matched?.id ?? "",
      accountName: matched?.name ?? accountName,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      averagePrice: Number.isFinite(averagePrice) ? averagePrice : 0,
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
      currency: (cols[5] || "USD").toUpperCase().slice(0, 3),
    });
  }
  return rows;
}
