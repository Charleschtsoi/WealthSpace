"use server";

import { revalidatePath } from "next/cache";
import { AccountType, TransactionType } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export type ActionResult = {
  success: boolean;
  message: string;
  count?: number;
};

type CsvRow = {
  Date: string;
  Account: string;
  "Ticker/Description": string;
  Amount: string;
  Currency: string;
};

function inferAccountType(name: string): AccountType {
  const lower = name.toLowerCase();
  if (
    lower.includes("property") ||
    lower.includes("real estate") ||
    lower.includes("home")
  ) {
    return AccountType.REAL_ESTATE;
  }
  if (
    lower.includes("cash") ||
    lower.includes("bank") ||
    lower.includes("hang seng") ||
    lower.includes("checking") ||
    lower.includes("savings")
  ) {
    return AccountType.CASH;
  }
  return AccountType.BROKERAGE;
}

function inferTransactionType(
  description: string,
  amount: number
): TransactionType {
  const lower = description.toLowerCase();
  if (lower.includes("buy") || lower.startsWith("b ")) {
    return TransactionType.BUY;
  }
  if (lower.includes("sell") || lower.startsWith("s ")) {
    return TransactionType.SELL;
  }
  if (amount >= 0) return TransactionType.DEPOSIT;
  return TransactionType.WITHDRAWAL;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return value;
}

function parseDate(raw: string): Date {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${raw}`);
  }
  return date;
}

export async function ingestCsvTransactions(
  rows: CsvRow[]
): Promise<ActionResult> {
  if (!rows.length) {
    return { success: false, message: "No rows found in CSV." };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      success: false,
      message:
        "DATABASE_URL is not configured. Preview the CSV here, then add a Postgres URL in Vercel to persist imports.",
    };
  }

  try {
    let imported = 0;

    for (const row of rows) {
      const accountName = row.Account?.trim();
      const description = row["Ticker/Description"]?.trim() || "Imported";
      const currency = row.Currency?.trim() || "USD";
      const amount = parseAmount(row.Amount);
      const date = parseDate(row.Date);

      if (!accountName) continue;

      let account = await prisma.account.findFirst({
        where: { name: accountName },
      });

      if (account) {
        account = await prisma.account.update({
          where: { id: account.id },
          data: {
            lastUpdated: date,
            balance: { increment: amount },
          },
        });
      } else {
        account = await prisma.account.create({
          data: {
            name: accountName,
            type: inferAccountType(accountName),
            balance: Math.abs(amount),
            currency,
            lastUpdated: date,
          },
        });
      }

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          type: inferTransactionType(description, amount),
          amount: Math.abs(amount),
          date,
          description,
        },
      });

      imported += 1;
    }

    revalidatePath("/");
    revalidatePath("/upload");
    revalidatePath("/advisor");

    return {
      success: true,
      message: `Imported ${imported} transaction(s).`,
      count: imported,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to import CSV. Ensure DATABASE_URL is configured.";
    return { success: false, message };
  }
}

export async function updateAccountBalance(input: {
  accountName: string;
  accountType: AccountType;
  balance: number;
  currency: string;
}): Promise<ActionResult> {
  const { accountName, accountType, balance, currency } = input;

  if (!accountName.trim()) {
    return { success: false, message: "Account name is required." };
  }
  if (Number.isNaN(balance)) {
    return { success: false, message: "Balance must be a valid number." };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      success: false,
      message:
        "DATABASE_URL is not configured. Add a Postgres URL in Vercel to save balances.",
    };
  }

  try {
    const existing = await prisma.account.findFirst({
      where: { name: accountName.trim() },
    });

    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: {
          balance,
          currency,
          type: accountType,
          lastUpdated: new Date(),
        },
      });
    } else {
      await prisma.account.create({
        data: {
          name: accountName.trim(),
          type: accountType,
          balance,
          currency,
          lastUpdated: new Date(),
        },
      });
    }

    revalidatePath("/");
    revalidatePath("/upload");
    revalidatePath("/advisor");

    return {
      success: true,
      message: `Updated balance for ${accountName.trim()}.`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update balance. Ensure DATABASE_URL is configured.";
    return { success: false, message };
  }
}
