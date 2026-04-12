import { formatCurrency } from '../../utils/format';

/**
 * Renders a monetary amount correctly for financial statements:
 *   - Normal balance: shows positive number
 *   - Abnormal balance: shows (number) in red with a tooltip
 *
 * Props:
 *   value        : the displayValue (always positive absolute amount)
 *   negative     : boolean — true = abnormal, show in brackets
 *   className    : extra classes
 *   showBadge    : show the ⚠ abnormal badge inline
 */
export function FinancialAmount({ value, negative, className = '', showBadge = false }) {
  if (negative) {
    return (
      <span className={`font-mono font-semibold text-expense ${className}`} title="Abnormal balance — account has crossed to the wrong side">
        ({formatCurrency(value)})
        {showBadge && <span className="ml-1 text-xs">⚠</span>}
      </span>
    );
  }
  return (
    <span className={`font-mono font-semibold text-gray-800 ${className}`}>
      {formatCurrency(value)}
    </span>
  );
}

/**
 * Inline warning badge for abnormal accounts.
 */
export function AbnormalBadge({ show, subAccount }) {
  if (!show) return null;
  const isAsset = ['Current Assets', 'Investments', 'Fixed Assets'].includes(subAccount);
  const tip = isAsset
    ? 'This asset account has a credit balance (overcredited beyond zero). Shown in brackets.'
    : 'This liability/equity account has a debit balance (overdebited). Shown in brackets.';
  return (
    <span className="badge bg-amber-100 text-amber-700 ml-2 cursor-help" title={tip}>⚠ Abnormal</span>
  );
}
