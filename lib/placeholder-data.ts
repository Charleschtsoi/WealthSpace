export type PlaceholderAccount = {
  id: string;
  name: string;
  type: "CASH" | "BROKERAGE" | "REAL_ESTATE";
  balance: number;
  currency: string;
  lastUpdated: string;
};

export type PlaceholderHolding = {
  id: string;
  accountId: string;
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency: string;
  accountName?: string;
};

export type PlaceholderSnapshot = {
  id: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export const PLACEHOLDER_ACCOUNTS: PlaceholderAccount[] = [
  {
    id: "acc_cash_hs",
    name: "Hang Seng",
    type: "CASH",
    balance: 84250,
    currency: "USD",
    lastUpdated: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "acc_broker_ft",
    name: "Firstrade",
    type: "BROKERAGE",
    balance: 412800,
    currency: "USD",
    lastUpdated: "2026-08-05T00:00:00.000Z",
  },
  {
    id: "acc_re_hk",
    name: "Property — Kowloon",
    type: "REAL_ESTATE",
    balance: 920000,
    currency: "USD",
    lastUpdated: "2026-07-15T00:00:00.000Z",
  },
];

export const PLACEHOLDER_HOLDINGS: PlaceholderHolding[] = [
  {
    id: "h1",
    accountId: "acc_broker_ft",
    ticker: "VOO",
    quantity: 220,
    averagePrice: 410.25,
    currentPrice: 528.4,
    currency: "USD",
    accountName: "Firstrade",
  },
  {
    id: "h2",
    accountId: "acc_broker_ft",
    ticker: "VXUS",
    quantity: 480,
    averagePrice: 55.1,
    currentPrice: 62.35,
    currency: "USD",
    accountName: "Firstrade",
  },
  {
    id: "h3",
    accountId: "acc_broker_ft",
    ticker: "NVDA",
    quantity: 95,
    averagePrice: 420.0,
    currentPrice: 118.75,
    currency: "USD",
    accountName: "Firstrade",
  },
  {
    id: "h4",
    accountId: "acc_broker_ft",
    ticker: "META",
    quantity: 55,
    averagePrice: 310.5,
    currentPrice: 512.2,
    currency: "USD",
    accountName: "Firstrade",
  },
  {
    id: "h5",
    accountId: "acc_broker_ft",
    ticker: "AAPL",
    quantity: 80,
    averagePrice: 165.0,
    currentPrice: 228.4,
    currency: "USD",
    accountName: "Firstrade",
  },
];

export const PLACEHOLDER_SNAPSHOTS: PlaceholderSnapshot[] = [
  { id: "s1", date: "2025-09-01", totalAssets: 1180000, totalLiabilities: 180000, netWorth: 1000000 },
  { id: "s2", date: "2025-10-01", totalAssets: 1215000, totalLiabilities: 178000, netWorth: 1037000 },
  { id: "s3", date: "2025-11-01", totalAssets: 1242000, totalLiabilities: 176000, netWorth: 1066000 },
  { id: "s4", date: "2025-12-01", totalAssets: 1288000, totalLiabilities: 174000, netWorth: 1114000 },
  { id: "s5", date: "2026-01-01", totalAssets: 1310000, totalLiabilities: 172000, netWorth: 1138000 },
  { id: "s6", date: "2026-02-01", totalAssets: 1295000, totalLiabilities: 170000, netWorth: 1125000 },
  { id: "s7", date: "2026-03-01", totalAssets: 1348000, totalLiabilities: 168000, netWorth: 1180000 },
  { id: "s8", date: "2026-04-01", totalAssets: 1372000, totalLiabilities: 166000, netWorth: 1206000 },
  { id: "s9", date: "2026-05-01", totalAssets: 1399000, totalLiabilities: 164000, netWorth: 1235000 },
  { id: "s10", date: "2026-06-01", totalAssets: 1415000, totalLiabilities: 162000, netWorth: 1253000 },
  { id: "s11", date: "2026-07-01", totalAssets: 1402000, totalLiabilities: 160000, netWorth: 1242000 },
  { id: "s12", date: "2026-08-01", totalAssets: 1417050, totalLiabilities: 158000, netWorth: 1259050 },
];

export function computeDashboardMetrics(
  accounts: PlaceholderAccount[],
  holdings: PlaceholderHolding[]
) {
  const liquidCash = accounts
    .filter((a) => a.type === "CASH")
    .reduce((sum, a) => sum + a.balance, 0);

  const realEstate = accounts
    .filter((a) => a.type === "REAL_ESTATE")
    .reduce((sum, a) => sum + a.balance, 0);

  const equities = holdings.reduce(
    (sum, h) => sum + h.quantity * h.currentPrice,
    0
  );

  const totalInvested = equities + realEstate;
  const totalNetWorth = liquidCash + totalInvested;

  return {
    totalNetWorth,
    liquidCash,
    totalInvested,
    allocation: [
      { name: "Cash", value: liquidCash, fill: "var(--chart-cash)" },
      { name: "Equities", value: equities, fill: "var(--chart-equities)" },
      { name: "Property", value: realEstate, fill: "var(--chart-property)" },
    ],
  };
}
