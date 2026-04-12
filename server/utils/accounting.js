/**
 * DOUBLE-ENTRY SIGN CONVENTION
 * ─────────────────────────────────────────────────────────────────────
 * Your system stores raw balance as:  openingBalance + Σ(credits - debits)
 *
 * NORMAL balance directions:
 *   Asset / Expense  → Debit-normal  → raw balance is NEGATIVE  (asset grows = more negative)
 *   Liability / Equity / Revenue → Credit-normal → raw balance is POSITIVE
 *
 * CONTRIBUTION to financial statement totals:
 *   Asset:    contribution = -rawBalance   (flip sign → positive dollar amount)
 *   Expense:  contribution = -rawBalance   (flip sign → positive dollar amount)
 *   Liability: contribution =  rawBalance  (already positive)
 *   Equity:   contribution =  rawBalance
 *   Revenue:  contribution =  rawBalance
 *
 * ABNORMAL balance = account has drifted to the wrong sign:
 *   Asset account with rawBalance > 0  → abnormal (overcredited)
 *   Liability/Equity/Revenue with rawBalance < 0 → abnormal (overdebited)
 *
 * In all statements, abnormal balances are shown in brackets (negative display)
 * and their contribution is STILL computed correctly using the sign rules above
 * — never with Math.abs().  This preserves the accounting equation at all times:
 *
 *   ΣAssets = ΣLiabilities + ΣEquity + NetIncome
 * ─────────────────────────────────────────────────────────────────────
 */

const ASSET_SUBS      = ['Current Assets', 'Investments', 'Fixed Assets'];
const LIABILITY_SUBS  = ['Current Liabilities', 'Short-term Liabilities', 'Long-term Liabilities'];
const EQUITY_SUBS     = ['Equity'];
const REVENUE_SUBS    = ['Revenue'];
const EXPENSE_SUBS    = ['Expenses'];

/**
 * Returns the "normal side" for a subAccount category.
 * 'debit'  → asset / expense  (raw balance stored negative)
 * 'credit' → liability / equity / revenue  (raw balance stored positive)
 */
function normalSide(subAccount) {
  if (ASSET_SUBS.includes(subAccount) || EXPENSE_SUBS.includes(subAccount)) return 'debit';
  return 'credit';
}

/**
 * Given a raw stored balance and the account's subAccount category,
 * return the SIGNED CONTRIBUTION to the financial statement total.
 *
 * Examples:
 *   Savings Bank (Current Assets), rawBalance = -38383  → contribution = +38383  ✓
 *   Savings Bank (Current Assets), rawBalance = +500    → contribution = -500    (abnormal — asset gone negative)
 *   House Loan (Long-term Liabilities), rawBalance = +14450000 → contribution = +14450000 ✓
 *   Credit Card (Current Liabilities), rawBalance = -1.23 → contribution = -1.23 (abnormal — liability gone negative)
 */
function signedContribution(rawBalance, subAccount) {
  if (normalSide(subAccount) === 'debit') {
    return -rawBalance; // flip: negative raw → positive contribution
  }
  return rawBalance;    // keep: positive raw → positive contribution
}

/**
 * Is this balance abnormal for its account type?
 */
function isAbnormal(rawBalance, subAccount) {
  if (normalSide(subAccount) === 'debit')   return rawBalance > 0;   // asset gone positive
  return rawBalance < 0;                                               // liability/equity gone negative
}

/**
 * Compute raw balance for an account from its opening balance + transaction totals.
 * Raw balance follows:  openingBalance + Σcredits - Σdebits
 */
function computeRawBalance(openingBalance, totalDebit, totalCredit) {
  return openingBalance + (totalCredit - totalDebit);
}

/**
 * Format a balance row for API responses — includes:
 *   rawBalance        : the actual stored value (may be wrong sign if abnormal)
 *   contribution      : correct signed dollar contribution to statement total
 *   isAbnormal        : true if account has drifted to wrong side
 *   displayValue      : absolute dollar amount for display
 *   displayNegative   : true → show in brackets in UI
 */
function formatBalanceRow(acc, totalDebit, totalCredit) {
  const raw = computeRawBalance(acc.openingBalance, totalDebit, totalCredit);
  const contrib = signedContribution(raw, acc.subAccount);
  const abnormal = isAbnormal(raw, acc.subAccount);
  return {
    rawBalance: raw,
    contribution: contrib,          // USE THIS for all totals/sums
    isAbnormal: abnormal,
    displayValue: Math.abs(contrib), // absolute amount for display
    displayNegative: contrib < 0,    // true → show (xxx) in UI
  };
}

module.exports = { normalSide, signedContribution, isAbnormal, computeRawBalance, formatBalanceRow, ASSET_SUBS, LIABILITY_SUBS, EQUITY_SUBS, REVENUE_SUBS, EXPENSE_SUBS };
