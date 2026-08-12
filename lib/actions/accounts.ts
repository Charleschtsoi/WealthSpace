"use server";

import { revalidatePath } from "next/cache";
import { AccountType } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPhantomPlaceholderId } from "@/lib/demo-mode";
import type { AccountRow, AccountTypeOption } from "@/lib/accounts-sheet";

export type SaveAccountsResult = {
  success: boolean;
  message: string;
  mode: "database" | "local";
  rows?: AccountRow[];
};

function toAccountType(value: AccountTypeOption): AccountType {
  switch (value) {
    case "CASH":
      return AccountType.CASH;
    case "BROKERAGE":
      return AccountType.BROKERAGE;
    case "CRYPTO":
      return AccountType.CRYPTO;
    case "REAL_ESTATE":
      return AccountType.REAL_ESTATE;
    default:
      return AccountType.CASH;
  }
}

function fromDbType(value: AccountType): AccountTypeOption {
  return value as AccountTypeOption;
}

export async function getAccountsForEditor(): Promise<{
  rows: AccountRow[];
  fromDb: boolean;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { rows: [], fromDb: false };
  }

  try {
    const accounts = await prisma.account.findMany({
      orderBy: { name: "asc" },
    });
    return {
      fromDb: accounts.length > 0,
      rows: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: fromDbType(a.type),
        balance: Number(a.balance),
        currency: a.currency,
        notes: a.notes ?? "",
        lastUpdated: a.lastUpdated.toISOString(),
        persisted: true,
      })),
    };
  } catch {
    return { rows: [], fromDb: false };
  }
}

export async function saveAccountsBatch(
  rows: AccountRow[]
): Promise<SaveAccountsResult> {
  const cleaned = rows
    .map((r) => ({
      ...r,
      name: r.name.trim(),
      currency: (r.currency || "USD").trim().toUpperCase().slice(0, 3) || "USD",
      notes: r.notes?.trim() || "",
      balance: Number(r.balance),
    }))
    .filter((r) => r.name.length > 0);

  if (!cleaned.length) {
    return {
      success: false,
      message: "Add at least one account with a name before saving.",
      mode: "local",
    };
  }

  for (const row of cleaned) {
    if (!Number.isFinite(row.balance)) {
      return {
        success: false,
        message: `Invalid balance for “${row.name}”.`,
        mode: "local",
      };
    }
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      success: true,
      mode: "local",
      message: `Saved ${cleaned.length} account(s) locally in this browser. Add DATABASE_URL to persist in Postgres.`,
      rows: cleaned.map((r) => ({
        ...r,
        lastUpdated: new Date().toISOString(),
        persisted: false,
      })),
    };
  }

  try {
    const existing = await prisma.account.findMany();
    const incomingIds = new Set(
      cleaned
        .filter(
          (r) =>
            r.persisted &&
            !isPhantomPlaceholderId(r.id)
        )
        .map((r) => r.id)
    );

    // Delete removed persisted accounts
    for (const account of existing) {
      if (!incomingIds.has(account.id)) {
        const stillNamed = cleaned.find(
          (r) =>
            r.name === account.name && isPhantomPlaceholderId(r.id)
        );
        if (!stillNamed) {
          await prisma.account.delete({ where: { id: account.id } });
        }
      }
    }

    const saved: AccountRow[] = [];

    for (const row of cleaned) {
      const data = {
        name: row.name,
        type: toAccountType(row.type),
        balance: row.balance,
        currency: row.currency,
        notes: row.notes || null,
        lastUpdated: new Date(),
      };

      // Never UPDATE by phantom demo ids — always create/merge by name.
      if (row.persisted && !isPhantomPlaceholderId(row.id)) {
        const updated = await prisma.account.update({
          where: { id: row.id },
          data,
        });
        saved.push({
          id: updated.id,
          name: updated.name,
          type: fromDbType(updated.type),
          balance: Number(updated.balance),
          currency: updated.currency,
          notes: updated.notes ?? "",
          lastUpdated: updated.lastUpdated.toISOString(),
          persisted: true,
        });
      } else {
        const byName = await prisma.account.findFirst({
          where: { name: row.name },
        });
        if (byName) {
          const updated = await prisma.account.update({
            where: { id: byName.id },
            data,
          });
          saved.push({
            id: updated.id,
            name: updated.name,
            type: fromDbType(updated.type),
            balance: Number(updated.balance),
            currency: updated.currency,
            notes: updated.notes ?? "",
            lastUpdated: updated.lastUpdated.toISOString(),
            persisted: true,
          });
        } else {
          const created = await prisma.account.create({ data });
          saved.push({
            id: created.id,
            name: created.name,
            type: fromDbType(created.type),
            balance: Number(created.balance),
            currency: created.currency,
            notes: created.notes ?? "",
            lastUpdated: created.lastUpdated.toISOString(),
            persisted: true,
          });
        }
      }
    }

    revalidatePath("/");
    revalidatePath("/money");
    revalidatePath("/accounts");
    revalidatePath("/advisor");
    revalidatePath("/upload");

    return {
      success: true,
      mode: "database",
      message: `Saved ${saved.length} account(s) to the database.`,
      rows: saved,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save accounts. If you added CRYPTO, run prisma db push.";
    return { success: false, mode: "database", message };
  }
}
