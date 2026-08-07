export type AccountTypeOption =
  | "CASH"
  | "BROKERAGE"
  | "CRYPTO"
  | "REAL_ESTATE";

export type AccountRow = {
  /** Client row id — may be a cuid from DB or a temporary local id */
  id: string;
  name: string;
  type: AccountTypeOption;
  balance: number;
  currency: string;
  notes: string;
  lastUpdated: string;
  /** True when this row existed in DB (vs local-only) */
  persisted?: boolean;
};

const STORAGE_KEY = "wealthspace.accounts.v1";

export const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  "CASH",
  "BROKERAGE",
  "CRYPTO",
  "REAL_ESTATE",
];

export function createEmptyAccountRow(): AccountRow {
  return {
    id: `local_${crypto.randomUUID()}`,
    name: "",
    type: "CASH",
    balance: 0,
    currency: "USD",
    notes: "",
    lastUpdated: new Date().toISOString(),
    persisted: false,
  };
}

export function loadLocalAccounts(): AccountRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountRow[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalAccounts(rows: AccountRow[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function clearLocalAccounts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function parseAccountsPaste(text: string): Partial<AccountRow>[] {
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
  if (first[0] === "account" || first[0] === "name") {
    start = 1;
  }

  const rows: Partial<AccountRow>[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = split(lines[i]).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (!cols[0]) continue;
    const typeRaw = (cols[1] || "CASH").toUpperCase().replace(/\s+/g, "_");
    const type = ACCOUNT_TYPE_OPTIONS.includes(typeRaw as AccountTypeOption)
      ? (typeRaw as AccountTypeOption)
      : "CASH";
    const balance = Number(String(cols[2] ?? "0").replace(/[$,]/g, ""));
    rows.push({
      name: cols[0],
      type,
      balance: Number.isFinite(balance) ? balance : 0,
      currency: (cols[3] || "USD").toUpperCase().slice(0, 3),
      notes: cols[4] || "",
    });
  }
  return rows;
}
