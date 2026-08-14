"use server";

import { revalidatePath } from "next/cache";
import { AccountType, TransactionType } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { recordNetWorthSnapshot } from "@/lib/net-worth-snapshot";
import {
  applyHoldingTrade,
  DB_UNAVAILABLE_IMPORT_HINT,
  fingerprintsFromTransactions,
  inferAccountTypeFromName,
  planCsvImport,
  type CsvRawRow,
  type HoldingLotState,
} from "@/lib/csv-import";

export type ActionResult = {
  success: boolean;
  message: string;
  count?: number;
  mode?: "database" | "local";
  /** When mode=local, client should apply this plan to localStorage */
  localPlan?: {
    toImport: ReturnType<typeof planCsvImport>["toImport"];
    duplicatesSkipped: number;
  };
};

function toPrismaAccountType(
  type: ReturnType<typeof inferAccountTypeFromName>
): AccountType {
  switch (type) {
    case "CASH":
      return AccountType.CASH;
    case "CRYPTO":
      return AccountType.CRYPTO;
    case "REAL_ESTATE":
      return AccountType.REAL_ESTATE;
    default:
      return AccountType.BROKERAGE;
  }
}

function toPrismaTxnType(type: string): TransactionType {
  switch (type) {
    case "BUY":
      return TransactionType.BUY;
    case "SELL":
      return TransactionType.SELL;
    case "WITHDRAWAL":
      return TransactionType.WITHDRAWAL;
    default:
      return TransactionType.DEPOSIT;
  }
}

function revalidateImportPaths() {
  revalidatePath("/");
  revalidatePath("/money");
  revalidatePath("/transactions");
  revalidatePath("/holdings");
  revalidatePath("/accounts");
  revalidatePath("/upload");
  revalidatePath("/advisor");
}

export async function ingestCsvTransactions(
  rows: CsvRawRow[]
): Promise<ActionResult> {
  if (!rows.length) {
    return { success: false, message: "No rows found in CSV." };
  }

  const prisma = getPrisma();
  if (!prisma) {
    const plan = planCsvImport(rows, []);
    if (!plan.toImport.length && plan.duplicates.length) {
      return {
        success: false,
        mode: "local",
        message:
          "Every row looks like a duplicate of itself in this file. Adjust dates/amounts or clear the file duplicates, then try again.",
        localPlan: {
          toImport: [],
          duplicatesSkipped: plan.duplicates.length,
        },
      };
    }
    return {
      success: true,
      mode: "local",
      count: plan.toImport.length,
      message: `${DB_UNAVAILABLE_IMPORT_HINT} Ready to apply ${plan.toImport.length} row(s) locally${
        plan.duplicates.length
          ? ` (${plan.duplicates.length} duplicate(s) skipped)`
          : ""
      }.`,
      localPlan: {
        toImport: plan.toImport,
        duplicatesSkipped: plan.duplicates.length,
      },
    };
  }

  try {
    const existingTxns = await prisma.transaction.findMany({
      include: { account: true },
    });
    const existingFingerprints = fingerprintsFromTransactions(
      existingTxns.map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        accountName: t.account.name,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
      }))
    );

    const plan = planCsvImport(rows, existingFingerprints);

    if (plan.invalid.length && !plan.toImport.length && !plan.duplicates.length) {
      return {
        success: false,
        mode: "database",
        message: `No valid rows. First error: ${plan.invalid[0].error}`,
      };
    }

    if (!plan.toImport.length) {
      return {
        success: false,
        mode: "database",
        message: plan.duplicates.length
          ? `Skipped ${plan.duplicates.length} duplicate row(s) — nothing new to import. Re-import is a no-op when Date+Account+Type+Amount+Description already exist.`
          : "No valid rows to import.",
      };
    }

    const accounts = await prisma.account.findMany({
      include: { holdings: true },
    });
    const accountByName = new Map(
      accounts.map((a) => [a.name.trim().toLowerCase(), a])
    );

    const lots = new Map<string, HoldingLotState>();
    for (const account of accounts) {
      for (const h of account.holdings) {
        const ticker = h.ticker.toUpperCase();
        lots.set(`${account.name.trim().toLowerCase()}|${ticker}`, {
          accountName: account.name,
          ticker,
          quantity: Number(h.quantity),
          averagePrice: Number(h.averagePrice),
          currentPrice: Number(h.currentPrice),
          currency: h.currency || "USD",
        });
      }
    }

    let imported = 0;
    let holdingsTouched = 0;

    for (const row of plan.toImport) {
      const key = row.accountName.trim().toLowerCase();
      let account = accountByName.get(key);
      const date = new Date(row.date);

      if (account) {
        account = await prisma.account.update({
          where: { id: account.id },
          data: {
            lastUpdated: date,
            balance: { increment: row.balanceDelta },
          },
          include: { holdings: true },
        });
        accountByName.set(key, account);
      } else {
        account = await prisma.account.create({
          data: {
            name: row.accountName,
            type: toPrismaAccountType(inferAccountTypeFromName(row.accountName)),
            balance: Math.max(0, row.balanceDelta),
            currency: row.currency,
            lastUpdated: date,
          },
          include: { holdings: true },
        });
        accountByName.set(key, account);
      }

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          type: toPrismaTxnType(row.type),
          amount: row.amount,
          date,
          description: row.description,
        },
      });

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
          const existingLot = await prisma.assetHolding.findFirst({
            where: {
              accountId: account.id,
              ticker: mutation.ticker,
            },
          });

          if (mutation.remove) {
            if (existingLot) {
              await prisma.assetHolding.delete({ where: { id: existingLot.id } });
              holdingsTouched += 1;
            }
          } else if (existingLot) {
            await prisma.assetHolding.update({
              where: { id: existingLot.id },
              data: {
                quantity: mutation.quantity,
                averagePrice: mutation.averagePrice,
                currentPrice: mutation.currentPrice,
                currency: mutation.currency,
              },
            });
            holdingsTouched += 1;
          } else {
            await prisma.assetHolding.create({
              data: {
                accountId: account.id,
                ticker: mutation.ticker,
                quantity: mutation.quantity,
                averagePrice: mutation.averagePrice,
                currentPrice: mutation.currentPrice,
                currency: mutation.currency,
              },
            });
            holdingsTouched += 1;
          }
        }
      }

      imported += 1;
    }

    if (imported > 0) {
      await recordNetWorthSnapshot(prisma);
    }

    revalidateImportPaths();

    const dupNote = plan.duplicates.length
      ? ` Skipped ${plan.duplicates.length} duplicate(s).`
      : "";
    const holdNote =
      holdingsTouched > 0
        ? ` Updated ${holdingsTouched} holding lot(s).`
        : "";

    return {
      success: true,
      mode: "database",
      message: `Imported ${imported} transaction(s).${holdNote}${dupNote}`,
      count: imported,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to import CSV. Check DATABASE_URL and CSV columns (Date, Account, Ticker/Description, Amount, Currency).";
    return {
      success: false,
      mode: "database",
      message: `${message} If Postgres is unreachable, remove DATABASE_URL temporarily to use browser-local import.`,
    };
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
      mode: "local",
      message:
        "DATABASE_URL is not configured. Update the balance on Money → Accounts (spreadsheet), or add a Postgres URL in Vercel to save here.",
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

    await recordNetWorthSnapshot(prisma);

    revalidateImportPaths();

    return {
      success: true,
      mode: "database",
      message: `Updated balance for ${accountName.trim()}.`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update balance. Ensure DATABASE_URL points at a reachable Postgres instance.";
    return { success: false, mode: "database", message };
  }
}
