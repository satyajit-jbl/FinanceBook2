/*
 * DISPLAY HELPERS — match the Excel sign convention
 *
 * currentBalance = Dr - Cr  (stored in DB and returned from API)
 *
 * Assets / Expenses → positive currentBalance
 * Liabilities / Equity / Revenue → negative currentBalance
 *
 * For display we always show absolute / unsigned values with context labels.
 */

export const formatCurrency = (amount, decimals = 2) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '৳ 0.00';
  return `৳ ${Math.abs(amount).toLocaleString('en-BD', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

export const formatNumber = (amount, decimals = 2) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
  return Math.abs(amount).toLocaleString('en-BD', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: '2-digit' });
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-BD', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

export const formatDateInput = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

export const txnTypeLabel = (type) => ({
  cash_receive:           'Cash Receive',
  cash_payment:           'Cash Payment',
  fund_transfer:          'Fund Transfer',
  multiple_fund_transfer: 'Multiple Transfer',
}[type] || type);

export const txnTypeColor = (type) => ({
  cash_receive:           'text-income bg-income-light',
  cash_payment:           'text-expense bg-expense-light',
  fund_transfer:          'text-blue-700 bg-blue-50',
  multiple_fund_transfer: 'text-purple-700 bg-purple-50',
}[type] || 'text-gray-700 bg-gray-100');

export const subAccountColor = (sub) => ({
  'Current Assets':        'text-blue-700',
  'Investments':           'text-indigo-700',
  'Fixed Assets':          'text-violet-700',
  'Current Liabilities':   'text-red-600',
  'Short-term Liabilities':'text-orange-600',
  'Long-term Liabilities': 'text-rose-700',
  'Equity':                'text-green-700',
  'Revenue':               'text-emerald-700',
  'Expenses':              'text-red-600',
}[sub] || 'text-gray-600');

// For Trial Balance display:
// Assets/Expenses have positive balance → show in Debit column
// Liabilities/Equity/Revenue have negative balance → show in Credit column
export const tbDebitAmount  = (currentBalance) => currentBalance > 0 ? Math.abs(currentBalance) : null;
export const tbCreditAmount = (currentBalance) => currentBalance < 0 ? Math.abs(currentBalance) : null;

// Balance Sheet display values (always positive)
export const assetDisplay     = (currentBalance) => currentBalance;           // positive for assets
export const liabilityDisplay = (currentBalance) => -currentBalance;          // flip: Cr-normal → positive
export const equityDisplay    = (currentBalance) => -currentBalance;          // flip: Cr-normal → positive
export const revenueDisplay   = (currentBalance) => -currentBalance;          // flip: Cr-normal → positive
export const expenseDisplay   = (currentBalance) => currentBalance;           // positive for expenses

export const today = () => new Date().toISOString().split('T')[0];

export const firstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};
