/**
 * Apply a CSV import plan to browser localStorage ledger (demo / no DATABASE_URL).
 */

import {
  applyHoldingTrade,
  fingerprintsFromTransactions,
  inferAccountTypeFromName,
  planCsvImport,
  type CsvImportPreviewRow,
  type CsvRawRow,
  type HoldingLotState,
} from "@/lib/csv-import";
import {
  createEmptyAccountRow,
  loadLocalAccounts,
  saveLocalAccounts,
  type AccountRow,
} from "@/lib/accounts-sheet";
import {
  loadLocalHoldings,
  saveLocalHoldings,
  type HoldingRow,
} from "@/lib/holdings-sheet";
import {
  loadLocalTransactions,
  saveLocalTransactions,
  type TransactionRow,
} from "@/lib/transactions-sheet";

export function applyCsvImportLocally(rows: CsvRawRow[]): {
  success: boolean;
  message: string;
  imported: number;
  duplicatesSkipped: number;
} {
  const accounts = [...(loadLocalAccounts() ?? [])];
  const holdings = [...(loadLocalHoldings() ?? [])];
  const transactions = [...(loadLocalTransactions() ?? [])];

  const existingFingerprints = fingerprintsFromTransactions(
    transactions.map((t) => ({
      date: t.date,
      accountName: t.accountName,
      type: t.type,
      amount: t.amount,
      description: t.description,
    }))
  );

  const plan = planCsvImport(rows, existingFingerprints);
  if (!plan.toImport.length) {
    return {
      success: false,
      imported: 0,
      duplicatesSkipped: plan.duplicates.length,
      message: plan.duplicates.length
        ? `Skipped ${plan.duplicates.length} duplicate row(s) — nothing new to import into this browser ledger.`
        : "No valid rows to import.",
    };
  }

  const accountByName = new Map(
    accounts.map((a) => [a.name.trim().toLowerCase(), a])
  );

  const lots = new Map<string, HoldingLotState>();
  for (const h of holdings) {
    const ticker = h.ticker.toUpperCase();
    const name = h.accountName.trim();
    lots.set(`${name.toLowerCase()}|${ticker}`, {
      accountName: name,
      ticker,
      quantity: Number(h.quantity) || 0,
      averagePrice: Number(h.averagePrice) || 0,
      currentPrice: Number(h.currentPrice) || 0,
      currency: h.currency || "USD",
    });
  }

  let holdingsTouched = 0;

  for (const row of plan.toImport) {
    const key = row.accountName.trim().toLowerCase();
    let account = accountByName.get(key);
    if (!account) {
      account = {
        ...createEmptyAccountRow(),
        name: row.accountName,
        type: inferAccountTypeFromName(row.accountName),
        balance: Math.max(0, row.balanceDelta),
        currency: row.currency,
        lastUpdated: new Date(row.date).toISOString(),
        persisted: false,
      };
      accounts.push(account);
      accountByName.set(key, account);
    } else {
      account.balance = Number(account.balance) + row.balanceDelta;
      account.lastUpdated = new Date(row.date).toISOString();
    }

    const txn: TransactionRow = {
      id: `local_${crypto.randomUUID()}`,
      date: row.date,
      accountId: account.id,
      accountName: account.name,
      type: row.type,
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      persisted: false,
    };
    transactions.push(txn);

    if (
      (row.type === "BUY" || row.type === "SELL") &&
      row.ticker &&
      row.quantity != null &&
      row.price != null &&
      row.holdingAction !== "none"
    ) {
      const mutation = applyHoldingTrade(lots, {
        accountName: account.name,
        ticker: row.ticker,
        type: row.type,
        quantity: row.quantity,
        price: row.price,
        currency: row.currency,
      });
      if (mutation) {
        holdingsTouched += 1;
        syncHoldingRow(holdings, account, mutation);
      }
    }
  }

  saveLocalAccounts(accounts);
  saveLocalHoldings(holdings.filter((h) => h.ticker && h.quantity > 0));
  saveLocalTransactions(transactions);

  const dupNote = plan.duplicates.length
    ? ` Skipped ${plan.duplicates.length} duplicate(s).`
    : "";
  const holdNote =
    holdingsTouched > 0 ? ` Updated ${holdingsTouched} holding lot(s).` : "";

  return {
    success: true,
    imported: plan.toImport.length,
    duplicatesSkipped: plan.duplicates.length,
    message: `Imported ${plan.toImport.length} transaction(s) into this browser.${holdNote}${dupNote} Add DATABASE_URL to persist in Postgres.`,
  };
}

function syncHoldingRow(
  holdings: HoldingRow[],
  account: AccountRow,
  mutation: {
    ticker: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    currency: string;
    remove: boolean;
  }
) {
  const idx = holdings.findIndex(
    (h) =>
      h.ticker.toUpperCase() === mutation.ticker &&
      (h.accountId === account.id ||
        h.accountName.trim().toLowerCase() ===
          account.name.trim().toLowerCase())
  );

  if (mutation.remove) {
    if (idx >= 0) holdings.splice(idx, 1);
    return;
  }

  if (idx >= 0) {
    holdings[idx] = {
      ...holdings[idx],
      accountId: account.id,
      accountName: account.name,
      ticker: mutation.ticker,
      quantity: mutation.quantity,
      averagePrice: mutation.averagePrice,
      currentPrice: mutation.currentPrice,
      currency: mutation.currency,
    };
    return;
  }

  holdings.push({
    id: `local_${crypto.randomUUID()}`,
    ticker: mutation.ticker,
    accountId: account.id,
    accountName: account.name,
    quantity: mutation.quantity,
    averagePrice: mutation.averagePrice,
    currentPrice: mutation.currentPrice,
    currency: mutation.currency,
    persisted: false,
  });
}

/** Client-side preview enrichment (types + duplicate hints within the file). */
export function previewCsvRows(rows: CsvRawRow[]): CsvImportPreviewRow[] {
  return planCsvImport(rows, []).preview;
}
