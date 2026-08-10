export const DATA_MODE_COOKIE = "wealthspace_data_mode";
export const ADVISOR_DEMO_ACK_KEY = "wealthspace_advisor_demo_ack";

export type DataMode = "demo" | "personal";

export type DataModeState = {
  /** User preference: explore demo sample vs personal ledger */
  preference: DataMode;
  /** True when Postgres is configured via DATABASE_URL */
  databaseConfigured: boolean;
  /** True when dashboard is serving placeholder sample rows */
  usingDemoData: boolean;
  /** True when live DB rows back the dashboard */
  isLive: boolean;
};

export function parseDataMode(value: string | undefined | null): DataMode {
  return value === "personal" ? "personal" : "demo";
}

/** Known synthetic ids from placeholder-data — never treat as Prisma rows. */
export function isPhantomPlaceholderId(id: string): boolean {
  if (!id) return true;
  if (id.startsWith("local_")) return true;
  if (id.startsWith("acc_")) return true;
  if (/^h\d+$/.test(id)) return true;
  if (/^s\d+$/.test(id)) return true;
  return false;
}
