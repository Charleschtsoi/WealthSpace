/**
 * Central ledger valuation + reconciliation (WS-31).
 *
 * Account-type balance semantics
 * ------------------------------
 * CASH
 *   Account.balance is truth (liquid cash). Holdings are not expected.
 *   Never emit reconciliation issues (no false positives).
 *
 * REAL_ESTATE
 *   Account.balance is the property mark / estimated value.
 *   Never emit reconciliation issues — even if stray holdings exist.
 *
 * BROKERAGE / CRYPTO
 *   When the account has one or more holdings:
 *     Account.balance is interpreted as a **total account equity mark**
 *     (cash sleeve + securities), not an uninvested cash sleeve alone.
 *     Compare stated balance to Σ(quantity × currentPrice) for that account.
 *     Flag when |stated − holdings MV| exceeds the threshold below.
 *   When the account has no holdings:
 *     Account.balance is the only valuation input (included in net worth).
 *     No reconciliation issue (nothing to disagree with).
 *
 * Net-worth double-count rules (same as WS-27 snapshots)
 * ------------------------------------------------------
 * - Always include CASH + REAL_ESTATE balances + all holdings MV.
 * - Include BROKERAGE/CRYPTO balance only when that account has no holdings.
 * - Liabilities = 0 until WS-13.
 */

export type ValuationAccountInput = {
  id: string;
  name?: string;
  type: string;
  balance: number;
};

export type ValuationHoldingInput = {
  accountId: string;
  quantity: number;
  currentPrice: number;
};

export type ComputedNetWorth = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export type ReconciliationIssueCode =
  | "BROKERAGE_BALANCE_VS_HOLDINGS"
  | "CRYPTO_BALANCE_VS_HOLDINGS";

export type ReconciliationIssue = {
  accountId: string;
  accountName: string;
  accountType: string;
  severity: "warning";
  code: ReconciliationIssueCode;
  statedBalance: number;
  computedHoldingsMv: number;
  delta: number;
  absDelta: number;
  message: string;
  fixHint: string;
  links: {
    accounts: "/money?tab=accounts";
    holdings: "/money?tab=holdings";
  };
};

/** Absolute floor in account currency units (USD cents-safe via roundMoney). */
export const RECONCILIATION_ABS_THRESHOLD = 1;

/** Relative band vs the larger of stated vs computed (0.5%). */
export const RECONCILIATION_REL_THRESHOLD = 0.005;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isCashType(type: string): boolean {
  return type === "CASH";
}

export function isRealEstateType(type: string): boolean {
  return type === "REAL_ESTATE";
}

export function isBrokerageLikeType(type: string): boolean {
  return type === "BROKERAGE" || type === "CRYPTO";
}

export function holdingsMvByAccount(
  holdings: ValuationHoldingInput[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const mv = Number(h.quantity) * Number(h.currentPrice);
    if (!Number.isFinite(mv)) continue;
    map.set(h.accountId, (map.get(h.accountId) ?? 0) + mv);
  }
  return map;
}

export function mismatchThreshold(stated: number, computed: number): number {
  const scale = Math.max(Math.abs(stated), Math.abs(computed), 0);
  return Math.max(
    RECONCILIATION_ABS_THRESHOLD,
    roundMoney(scale * RECONCILIATION_REL_THRESHOLD)
  );
}

/**
 * Double-count-safe net worth from ledger rows.
 * Prefer importing this (or the snapshot re-export) everywhere NW is computed.
 */
export function computeNetWorthFromLedger(
  accounts: ValuationAccountInput[],
  holdings: ValuationHoldingInput[]
): ComputedNetWorth {
  const byAccount = holdingsMvByAccount(holdings);
  let holdingsMv = 0;
  byAccount.forEach((mv) => {
    holdingsMv += mv;
  });

  let accountAssets = 0;
  for (const account of accounts) {
    const balance = Number(account.balance);
    if (!Number.isFinite(balance)) continue;
    const type = String(account.type);

    if (isCashType(type) || isRealEstateType(type)) {
      accountAssets += balance;
      continue;
    }

    if (isBrokerageLikeType(type)) {
      const hasHoldings = (byAccount.get(account.id) ?? 0) > 0;
      if (!hasHoldings) accountAssets += balance;
      continue;
    }

    // Unknown types: include balance only if no holdings on the account.
    if (!(byAccount.get(account.id) ?? 0)) {
      accountAssets += balance;
    }
  }

  const totalAssets = roundMoney(accountAssets + holdingsMv);
  const totalLiabilities = 0;
  return {
    totalAssets,
    totalLiabilities,
    netWorth: roundMoney(totalAssets - totalLiabilities),
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

/**
 * Emit structured reconciliation flags for advisor + UI.
 * Conservative: only BROKERAGE/CRYPTO accounts that already have holdings.
 */
export function reconcileLedger(
  accounts: ValuationAccountInput[],
  holdings: ValuationHoldingInput[]
): ReconciliationIssue[] {
  const byAccount = holdingsMvByAccount(holdings);
  const issues: ReconciliationIssue[] = [];

  for (const account of accounts) {
    const type = String(account.type);
    if (!isBrokerageLikeType(type)) continue;

    const holdingsMv = roundMoney(byAccount.get(account.id) ?? 0);
    if (holdingsMv <= 0) continue; // no holdings → no mismatch (AC)

    const stated = roundMoney(Number(account.balance));
    if (!Number.isFinite(stated)) continue;

    const delta = roundMoney(stated - holdingsMv);
    const absDelta = Math.abs(delta);
    const threshold = mismatchThreshold(stated, holdingsMv);
    if (absDelta <= threshold) continue;

    const name = account.name?.trim() || account.id;
    const code: ReconciliationIssueCode =
      type === "CRYPTO"
        ? "CRYPTO_BALANCE_VS_HOLDINGS"
        : "BROKERAGE_BALANCE_VS_HOLDINGS";

    const direction =
      delta > 0
        ? "stated balance is higher than holdings market value"
        : "stated balance is lower than holdings market value";

    issues.push({
      accountId: account.id,
      accountName: name,
      accountType: type,
      severity: "warning",
      code,
      statedBalance: stated,
      computedHoldingsMv: holdingsMv,
      delta,
      absDelta,
      message: `${name}: ${direction} (balance ${formatMoney(stated)} vs holdings ${formatMoney(holdingsMv)}; Δ ${formatMoney(delta)}).`,
      fixHint:
        "Edit the account balance to match total equity, or update holdings prices/quantities so they reconcile.",
      links: {
        accounts: "/money?tab=accounts",
        holdings: "/money?tab=holdings",
      },
    });
  }

  return issues;
}
