"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import {
  DATA_MODE_COOKIE,
  isPhantomPlaceholderId,
  parseDataMode,
} from "@/lib/demo-mode";
import type { HoldingAccountOption, HoldingRow } from "@/lib/holdings-sheet";
import { PLACEHOLDER_ACCOUNTS } from "@/lib/placeholder-data";

export type SaveHoldingsResult = {
  success: boolean;
  message: string;
  mode: "database" | "local";
  rows?: HoldingRow[];
};

export async function getAccountOptionsForHoldings(): Promise<{
  accounts: HoldingAccountOption[];
  fromDb: boolean;
  preference: "demo" | "personal";
}> {
  const preference = parseDataMode(cookies().get(DATA_MODE_COOKIE)?.value);
  const prisma = getPrisma();
  if (prisma) {
    try {
      const accounts = await prisma.account.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      if (accounts.length > 0) {
        return { accounts, fromDb: true, preference };
      }
    } catch {
      // fall through
    }
  }

  if (preference === "personal") {
    return { fromDb: false, accounts: [], preference };
  }

  return {
    fromDb: false,
    preference,
    accounts: PLACEHOLDER_ACCOUNTS.map((a) => ({ id: a.id, name: a.name })),
  };
}

export async function getHoldingsForEditor(): Promise<{
  rows: HoldingRow[];
  fromDb: boolean;
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { rows: [], fromDb: false };
  }

  try {
    const holdings = await prisma.assetHolding.findMany({
      include: { account: true },
      orderBy: { ticker: "asc" },
    });
    return {
      fromDb: holdings.length > 0,
      rows: holdings.map((h) => ({
        id: h.id,
        ticker: h.ticker,
        accountId: h.accountId,
        accountName: h.account.name,
        quantity: Number(h.quantity),
        averagePrice: Number(h.averagePrice),
        currentPrice: Number(h.currentPrice),
        currency: h.currency,
        persisted: true,
      })),
    };
  } catch {
    return { rows: [], fromDb: false };
  }
}

export async function saveHoldingsBatch(
  rows: HoldingRow[]
): Promise<SaveHoldingsResult> {
  const cleaned = rows
    .map((r) => ({
      ...r,
      ticker: r.ticker.trim().toUpperCase(),
      accountId: r.accountId.trim(),
      accountName: r.accountName.trim(),
      currency: (r.currency || "USD").trim().toUpperCase().slice(0, 3) || "USD",
      quantity: Number(r.quantity),
      averagePrice: Number(r.averagePrice),
      currentPrice: Number(r.currentPrice),
    }))
    .filter((r) => r.ticker.length > 0);

  if (!cleaned.length) {
    return {
      success: false,
      message: "Add at least one holding with a ticker before saving.",
      mode: "local",
    };
  }

  for (const row of cleaned) {
    if (!row.accountId && !row.accountName) {
      return {
        success: false,
        message: `Account required for “${row.ticker}”.`,
        mode: "local",
      };
    }
    if (
      !Number.isFinite(row.quantity) ||
      !Number.isFinite(row.averagePrice) ||
      !Number.isFinite(row.currentPrice)
    ) {
      return {
        success: false,
        message: `Invalid numbers for “${row.ticker}”.`,
        mode: "local",
      };
    }
  }

  const prisma = getPrisma();
  if (!prisma) {
    return {
      success: true,
      mode: "local",
      message: `Saved ${cleaned.length} holding(s) locally in this browser. Add DATABASE_URL to persist in Postgres.`,
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

    const resolved: Array<HoldingRow & { resolvedAccountId: string }> = [];

    for (const row of cleaned) {
      let account = row.accountId ? byId.get(row.accountId) : undefined;
      if (!account && row.accountName) {
        account = byName.get(row.accountName.toLowerCase());
      }
      if (!account) {
        return {
          success: false,
          message: `Unknown account for “${row.ticker}”. Create it on Accounts first.`,
          mode: "database",
        };
      }
      resolved.push({
        ...row,
        resolvedAccountId: account.id,
        accountName: account.name,
      });
    }

    // Never resolve holdings onto phantom demo account ids.
    for (const row of resolved) {
      if (isPhantomPlaceholderId(row.resolvedAccountId)) {
        return {
          success: false,
          message: `“${row.ticker}” still points at a demo account id. Create a real account on Accounts first, then reassign.`,
          mode: "database",
        };
      }
    }

    const existing = await prisma.assetHolding.findMany();
    const incomingIds = new Set(
      resolved
        .filter((r) => r.persisted && !isPhantomPlaceholderId(r.id))
        .map((r) => r.id)
    );

    for (const holding of existing) {
      if (!incomingIds.has(holding.id)) {
        await prisma.assetHolding.delete({ where: { id: holding.id } });
      }
    }

    const saved: HoldingRow[] = [];

    for (const row of resolved) {
      const data = {
        accountId: row.resolvedAccountId,
        ticker: row.ticker,
        quantity: row.quantity,
        averagePrice: row.averagePrice,
        currentPrice: row.currentPrice,
        currency: row.currency,
      };

      if (row.persisted && !isPhantomPlaceholderId(row.id)) {
        const updated = await prisma.assetHolding.update({
          where: { id: row.id },
          data,
          include: { account: true },
        });
        saved.push({
          id: updated.id,
          ticker: updated.ticker,
          accountId: updated.accountId,
          accountName: updated.account.name,
          quantity: Number(updated.quantity),
          averagePrice: Number(updated.averagePrice),
          currentPrice: Number(updated.currentPrice),
          currency: updated.currency,
          persisted: true,
        });
      } else {
        const created = await prisma.assetHolding.create({
          data,
          include: { account: true },
        });
        saved.push({
          id: created.id,
          ticker: created.ticker,
          accountId: created.accountId,
          accountName: created.account.name,
          quantity: Number(created.quantity),
          averagePrice: Number(created.averagePrice),
          currentPrice: Number(created.currentPrice),
          currency: created.currency,
          persisted: true,
        });
      }
    }

    revalidatePath("/");
    revalidatePath("/money");
    revalidatePath("/holdings");
    revalidatePath("/accounts");
    revalidatePath("/advisor");
    revalidatePath("/upload");

    return {
      success: true,
      mode: "database",
      message: `Saved ${saved.length} holding(s) to the database.`,
      rows: saved,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save holdings.";
    return { success: false, mode: "database", message };
  }
}
