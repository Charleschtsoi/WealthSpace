"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DATA_MODE_COOKIE,
  parseDataMode,
  type DataMode,
} from "@/lib/demo-mode";
import { getPrisma } from "@/lib/prisma";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function revalidateLedgerPaths() {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/holdings");
  revalidatePath("/advisor");
  revalidatePath("/upload");
  revalidatePath("/settings");
}

export async function getDataModePreference(): Promise<DataMode> {
  return parseDataMode(cookies().get(DATA_MODE_COOKIE)?.value);
}

export async function getDataModeMeta(): Promise<{
  preference: DataMode;
  databaseConfigured: boolean;
}> {
  const preference = await getDataModePreference();
  return {
    preference,
    databaseConfigured: Boolean(getPrisma()),
  };
}

export async function setDataModePreference(
  mode: DataMode
): Promise<{ success: true; preference: DataMode }> {
  cookies().set(DATA_MODE_COOKIE, mode, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });

  revalidateLedgerPaths();
  return { success: true, preference: mode };
}

/** Prefer personal ledger — empty sheets instead of silent demo masquerade. */
export async function startPersonalLedger(): Promise<{
  success: true;
  preference: DataMode;
  databaseConfigured: boolean;
}> {
  await setDataModePreference("personal");
  return {
    success: true,
    preference: "personal",
    databaseConfigured: Boolean(getPrisma()),
  };
}

/** Explicitly opt into the sample portfolio for exploration. */
export async function loadSamplePortfolio(): Promise<{
  success: true;
  preference: DataMode;
  seedHint: string;
}> {
  await setDataModePreference("demo");
  const databaseConfigured = Boolean(getPrisma());
  return {
    success: true,
    preference: "demo",
    seedHint: databaseConfigured
      ? "Demo UI data is back on. To seed Postgres with the sample ledger, run npm run db:seed locally (or in your DB host)."
      : "Sample portfolio loaded in the UI. Add DATABASE_URL and run npm run db:seed when you want it in Postgres.",
  };
}
