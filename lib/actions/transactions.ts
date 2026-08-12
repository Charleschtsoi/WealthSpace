"use server";

import { revalidatePath } from "next/cache";
import { TransactionType } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { recordNetWorthSnapshot } from "@/lib/net-worth-snapshot";
import type {
  TransactionAccountOption,
  TransactionRow,
  TransactionTypeOption,
} from "@/lib/transactions-sheet";
import { PLACEHOLDER_ACCOUNTS } from "@/lib/placeholder-data";

export type SaveTransactionsResult = {
  success: boolean;
  message: string;
  mode: "database" | "local";
  rows?: TransactionRow[];
};

function toTransactionType(value: TransactionTypeOption): TransactionType {
  switch (value) {
    case "DEPOSIT":
      return TransactionType.DEPOSIT;
    case "WITHDRAWAL":
      return TransactionType.WITHDRAWAL;
    case "BUY":
      return TransactionType.BUY;
    case "SELL":
      return TransactionType.SELL;
    default:
      return TransactionType.DEPOSIT;
  }
}

function fromDbType(value: TransactionType): TransactionTypeOption {
  return value as TransactionTypeOption;
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function getAccountOptionsForTransactions(): Promise<{
  accounts: TransactionAccountOption[];
  fromDb: boolean;
}> {
  const prisma = getPrisma();
  if (prisma) {
    try {
      const accounts = await prisma.account.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, currency: true },
      });
      if (accounts.length > 0) {
        return { accounts, fromDb: true };
      }
    } catch {
      // fall through to placeholders
    }
  }

  return {
    fromDb: false,
    accounts: PLACEHOLDER_ACCOUNTS.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
    })),
  };
}

export async function getTransactionsForEditor(): Promise<{
  rows: TransactionRow[];
  fromDb: boolean;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { rows: [], fromDb: false };
  }

  try {
    const transactions = await prisma.transaction.findMany({
      include: { account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return {
      fromDb: transactions.length > 0,
      rows: transactions.map((t) => ({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        accountId: t.accountId,
        accountName: t.account.name,
        type: fromDbType(t.type),
        amount: Number(t.amount),
        currency: t.account.currency || "USD",
        description: t.description ?? "",
        persisted: true,
      })),
    };
  } catch {
    return { rows: [], fromDb: false };
  }
}

export async function saveTransactionsBatch(
  rows: TransactionRow[]
): Promise<SaveTransactionsResult> {
  const cleaned: TransactionRow[] = [];

  for (const row of rows) {
    const date = normalizeDate(row.date);
    const accountName = row.accountName.trim();
    const accountId = row.accountId.trim();
    const currency =
      (row.currency || "USD").trim().toUpperCase().slice(0, 3) || "USD";
    const amount = Number(row.amount);
    const description = row.description?.trim() || "";

    // Skip completely blank draft rows
    if (!date && !accountId && !accountName && !description && !amount) {
      continue;
    }

    cleaned.push({
      ...row,
      date: date || row.date.trim(),
      accountId,
      accountName,
      currency,
      amount,
      description,
      type: row.type,
    });
  }

  if (!cleaned.length) {
    return {
      success: false,
      message: "Add at least one transaction before saving.",
      mode: "local",
    };
  }

  for (const row of cleaned) {
    if (!normalizeDate(row.date)) {
      return {
        success: false,
        message: `Invalid date on row “${row.description || row.type}”.`,
        mode: "local",
      };
    }
    if (!row.accountId && !row.accountName) {
      return {
        success: false,
        message: "Every transaction needs an account.",
        mode: "local",
      };
    }
    if (!Number.isFinite(row.amount) || row.amount < 0) {
      return {
        success: false,
        message: `Amount must be a non-negative number (“${row.description || row.type}”).`,
        mode: "local",
      };
    }
    if (!/^[A-Z]{3}$/.test(row.currency)) {
      return {
        success: false,
        message: `Currency must be a 3-letter code (“${row.description || row.type}”).`,
        mode: "local",
      };
    }
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      success: true,
      mode: "local",
      message: `Saved ${cleaned.length} transaction(s) locally in this browser. Add DATABASE_URL to persist in Postgres.`,
      rows: cleaned.map((r) => ({
        ...r,
        persisted: false,
      })),
    };
  }

  try {
    const dbAccounts = await prisma.account.findMany();
    const byId = new Map(dbAccounts.map((a) => [a.id, a]));
    const byName = new Map(
      dbAccounts.map((a) => [a.name.trim().toLowerCase(), a])
    );

    const resolved: Array<TransactionRow & { resolvedAccountId: string }> = [];

    for (const row of cleaned) {
      let account = row.accountId ? byId.get(row.accountId) : undefined;
      if (!account && row.accountName) {
        account = byName.get(row.accountName.toLowerCase());
      }
      if (!account) {
        return {
          success: false,
          message: `Unknown account “${row.accountName || row.accountId}”. Create it on Accounts first.`,
          mode: "database",
        };
      }
      resolved.push({
        ...row,
        resolvedAccountId: account.id,
        accountName: account.name,
        currency: row.currency || account.currency || "USD",
      });
    }

    const existing = await prisma.transaction.findMany();
    const incomingIds = new Set(
      resolved
        .filter((r) => r.persisted && !r.id.startsWith("local_"))
        .map((r) => r.id)
    );

    for (const txn of existing) {
      if (!incomingIds.has(txn.id)) {
        await prisma.transaction.delete({ where: { id: txn.id } });
      }
    }

    const saved: TransactionRow[] = [];

    for (const row of resolved) {
      const data = {
        accountId: row.resolvedAccountId,
        type: toTransactionType(row.type),
        amount: row.amount,
        date: new Date(row.date),
        description: row.description || null,
      };

      if (row.persisted && !row.id.startsWith("local_")) {
        const updated = await prisma.transaction.update({
          where: { id: row.id },
          data,
          include: { account: true },
        });
        saved.push({
          id: updated.id,
          date: updated.date.toISOString().slice(0, 10),
          accountId: updated.accountId,
          accountName: updated.account.name,
          type: fromDbType(updated.type),
          amount: Number(updated.amount),
          currency: row.currency || updated.account.currency || "USD",
          description: updated.description ?? "",
          persisted: true,
        });
      } else {
        const created = await prisma.transaction.create({
          data,
          include: { account: true },
        });
        saved.push({
          id: created.id,
          date: created.date.toISOString().slice(0, 10),
          accountId: created.accountId,
          accountName: created.account.name,
          type: fromDbType(created.type),
          amount: Number(created.amount),
          currency: row.currency || created.account.currency || "USD",
          description: created.description ?? "",
          persisted: true,
        });
      }
    }

    // Stable newest-first order for the editor
    saved.sort((a, b) => b.date.localeCompare(a.date));

    // Transactions alone do not change balances/holdings today, but still
    // refresh today's snapshot so CSV+sheet ledger edits stay aligned.
    await recordNetWorthSnapshot(prisma);

    revalidatePath("/");
    revalidatePath("/money");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/advisor");
    revalidatePath("/upload");

    return {
      success: true,
      mode: "database",
      message: `Saved ${saved.length} transaction(s) to the database.`,
      rows: saved,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save transactions.";
    return { success: false, mode: "database", message };
  }
}
