export type MoneyActivityKind =
  | "accounts_save"
  | "holdings_save"
  | "transactions_save"
  | "csv_import"
  | "manual_balance";

export type MoneyActivity = {
  id: string;
  kind: MoneyActivityKind;
  summary: string;
  at: string;
  detail?: string;
};

const STORAGE_KEY = "wealthspace.money.activity.v1";
const MAX_ITEMS = 40;

export function loadMoneyActivity(): MoneyActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MoneyActivity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordMoneyActivity(
  kind: MoneyActivityKind,
  summary: string,
  detail?: string
): MoneyActivity {
  const entry: MoneyActivity = {
    id: `act_${crypto.randomUUID()}`,
    kind,
    summary,
    detail,
    at: new Date().toISOString(),
  };
  if (typeof window === "undefined") return entry;
  try {
    const prev = loadMoneyActivity();
    const next = [entry, ...prev].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("wealthspace:money-activity"));
  } catch {
    // ignore quota / private mode
  }
  return entry;
}

export function clearMoneyActivity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("wealthspace:money-activity"));
}

export const MONEY_ACTIVITY_LABELS: Record<MoneyActivityKind, string> = {
  accounts_save: "Accounts",
  holdings_save: "Holdings",
  transactions_save: "Transactions",
  csv_import: "Import",
  manual_balance: "Balance",
};
