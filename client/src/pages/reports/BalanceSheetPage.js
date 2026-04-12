import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { formatCurrency, today } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

/*
 * DISPLAY RULES:
 *
 * Assets (Dr-normal → positive currentBalance):
 *   Normal:   display as-is  e.g. ৳1,845
 *   Abnormal: negative currentBalance → show in brackets (৳1,845) in red
 *
 * Liabilities & Equity (Cr-normal → negative currentBalance):
 *   Normal:   display = -currentBalance (flip to positive)  e.g. ৳14,450,398
 *   Abnormal: positive currentBalance → show in brackets (৳500) in red (account has Dr balance when it should be Cr)
 *
 * The "display value" for totals always uses abs() — brackets are UI only.
 */

// Readable label for accountType
const TYPE_LABELS = {
  'Cash':                       'Cash & Cash Equivalent',
  'Savings Bank Account':       'Bank Accounts',
  'Digital Wallet':             'Digital Wallets',
  'Fixed Deposit Account':      'Fixed Deposit Accounts',
  'DPS Account':                'DPS / Smart Accounts',
  'Accounts Receivable (Lending)': 'Accounts Receivable',
  'Savings Certificate':        'Savings Certificates (Sanchayapatra)',
  'investment':                 'Investments',
  'Investment':                 'Investments',
  'Insurence':                  'Insurance Policies',
  'Share':                      'Shares & Securities',
  'Other account':              'Other Investments',
  'Fixed Assets':               'Fixed Assets',
  'Credit Card':                'Credit Card Payables',
  'Borrowings':                 'Borrowings / Payables',
  'Other':                      'Other Liabilities',
  'Short-term Loans':           'Short-term Loans',
  'Long-term Liabilities':      'Long-term Loans',
  'Equity':                     'Owner\'s Capital',
};

// Asset type display order
const ASSET_TYPE_ORDER = [
  'Cash', 'Savings Bank Account', 'Digital Wallet', 'Fixed Deposit Account',
  'DPS Account', 'Accounts Receivable (Lending)',
  'Savings Certificate', 'investment', 'Investment', 'Insurence', 'Share', 'Other account',
  'Fixed Assets',
];
const LIAB_TYPE_ORDER = ['Credit Card', 'Borrowings', 'Other', 'Short-term Loans', 'Long-term Liabilities'];
const EQUITY_TYPE_ORDER = ['Equity'];

// Format a monetary value with bracket notation for abnormal balances
// isNormalPositive: true for assets/expenses (should be positive)
// isNormalNegative: true for liabilities/equity/revenue (should be negative)
function formatBS(rawBalance, isNormalPositive) {
  const displayValue = isNormalPositive ? rawBalance : -rawBalance;
  const isAbnormal = isNormalPositive ? rawBalance < 0 : rawBalance > 0;

  if (Math.abs(displayValue) < 0.005) return <span className="text-gray-300">—</span>;

  return isAbnormal
    ? <span className="font-mono text-sm font-semibold text-expense">({formatCurrency(Math.abs(displayValue))})</span>
    : <span className="font-mono text-sm font-semibold text-gray-800">{formatCurrency(Math.abs(displayValue))}</span>;
}

function formatBSTotal(total, isAbnormal) {
  if (isAbnormal) {
    return <span className="font-mono font-bold text-expense">({formatCurrency(Math.abs(total))})</span>;
  }
  return <span className="font-mono font-bold">{formatCurrency(Math.abs(total))}</span>;
}

// Group accounts by accountType and render with sub-totals
function BSSection({ title, accounts, typeOrder, isNormalPositive, headerBg, headerColor, totalLabel, total }) {
  // Group by accountType
  const groups = {};
  for (const acc of accounts) {
    const k = acc.accountType || 'Other';
    if (!groups[k]) groups[k] = [];
    groups[k].push(acc);
  }
  // Order groups
  const orderedTypes = [
    ...typeOrder.filter(t => groups[t]),
    ...Object.keys(groups).filter(t => !typeOrder.includes(t)),
  ];

  // Total for display
  const displayTotal = isNormalPositive ? total : -total;
  const totalIsAbnormal = isNormalPositive ? total < 0 : total > 0;

  return (
    <div>
      {/* Section header */}
      <div className={`px-5 py-2.5 border-b ${headerBg}`}>
        <h3 className={`text-xs font-bold uppercase tracking-widest ${headerColor}`}>{title}</h3>
      </div>

      {orderedTypes.map(type => {
        const items = groups[type];
        if (!items || !items.length) return null;
        const label = TYPE_LABELS[type] || type;
        const subTotal = items.reduce((s, a) => s + a.currentBalance, 0);
        const subDisplay = isNormalPositive ? subTotal : -subTotal;
        const subAbnormal = isNormalPositive ? subTotal < 0 : subTotal > 0;

        return (
          <div key={type}>
            {/* Type group label */}
            <div className="px-5 py-1.5 bg-surface-50 border-b border-surface-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            {/* Account rows */}
            {items.map(acc => (
              <div key={acc._id}
                className="flex justify-between items-center px-5 py-2 border-b border-surface-50 hover:bg-surface-50/70 transition-colors pl-9">
                <span className="text-sm text-gray-700">{acc.accountTitle}</span>
                {formatBS(acc.currentBalance, isNormalPositive)}
              </div>
            ))}
            {/* Type subtotal */}
            <div className="flex justify-between items-center px-5 py-1.5 bg-surface-100 border-b border-surface-200 pl-9">
              <span className="text-xs font-semibold text-gray-500">Total {label}</span>
              {formatBSTotal(Math.abs(subDisplay), subAbnormal)}
            </div>
          </div>
        );
      })}

      {/* Section total */}
      <div className={`flex justify-between items-center px-5 py-3 border-b ${headerBg}`}>
        <span className={`font-bold text-sm ${headerColor}`}>{totalLabel}</span>
        {formatBSTotal(Math.abs(displayTotal), totalIsAbnormal)}
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [asOfDate, setAsOfDate] = useState(today());

  const load = async (date = asOfDate) => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/reports/balance-sheet?asOfDate=${date}`);
      setData(res);
    } catch { toast.error('Failed to load balance sheet'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="text-gray-400 text-sm">Statement of Financial Position · As of {asOfDate}</p>
        </div>
        <button onClick={() => window.print()} className="btn btn-secondary no-print">🖨 Print</button>
      </div>

      <div className="card p-4 flex gap-3 items-end no-print">
        <div>
          <label className="label">As Of Date</label>
          <input type="date" className="input" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
        </div>
        <button onClick={() => load(asOfDate)} className="btn-primary">Apply</button>
      </div>

      {/* Balance equation banner */}
      {data && (
        <div className={`p-4 rounded-xl border-2 flex items-center gap-4
          ${data.isBalanced ? 'bg-income-light border-income/40 text-income' : 'bg-expense-light border-expense/40 text-expense'}`}>
          <span className="text-3xl">{data.isBalanced ? '⚖️' : '⚠️'}</span>
          <div className="flex-1">
            <p className="font-bold">{data.isBalanced ? 'Balance Sheet is Balanced ✓' : 'NOT Balanced — check entries'}</p>
            <p className="text-xs opacity-80 mt-0.5">Assets = Liabilities + Equity &nbsp;|&nbsp;
              <span className="text-xs opacity-60">( ) = abnormal balance</span>
            </p>
          </div>
          <div className="text-right font-mono">
            <p className="font-bold text-lg">{formatCurrency(data.totalAssets)}</p>
            <p className="text-xs opacity-70">= {formatCurrency(data.totalLiabilities)} + {formatCurrency(data.totalEquity)}</p>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ═══ ASSETS ═══ */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-primary-600 text-white">
              <h2 className="font-bold uppercase tracking-wide text-sm">ASSETS</h2>
            </div>

            {/* Current Assets */}
            <BSSection
              title="Current Assets"
              accounts={data.assetAccounts.filter(a => a.subAccount === 'Current Assets')}
              typeOrder={ASSET_TYPE_ORDER}
              isNormalPositive={true}
              headerBg="bg-blue-50 border-blue-100"
              headerColor="text-blue-700"
              totalLabel="Total Current Assets"
              total={data.assetAccounts.filter(a => a.subAccount === 'Current Assets').reduce((s, a) => s + a.currentBalance, 0)}
            />

            {/* Investments */}
            {data.assetAccounts.some(a => a.subAccount === 'Investments') && (
              <BSSection
                title="Investments"
                accounts={data.assetAccounts.filter(a => a.subAccount === 'Investments')}
                typeOrder={ASSET_TYPE_ORDER}
                isNormalPositive={true}
                headerBg="bg-indigo-50 border-indigo-100"
                headerColor="text-indigo-700"
                totalLabel="Total Investments"
                total={data.assetAccounts.filter(a => a.subAccount === 'Investments').reduce((s, a) => s + a.currentBalance, 0)}
              />
            )}

            {/* Fixed Assets */}
            {data.assetAccounts.some(a => a.subAccount === 'Fixed Assets') && (
              <BSSection
                title="Fixed Assets"
                accounts={data.assetAccounts.filter(a => a.subAccount === 'Fixed Assets')}
                typeOrder={ASSET_TYPE_ORDER}
                isNormalPositive={true}
                headerBg="bg-violet-50 border-violet-100"
                headerColor="text-violet-700"
                totalLabel="Total Fixed Assets"
                total={data.assetAccounts.filter(a => a.subAccount === 'Fixed Assets').reduce((s, a) => s + a.currentBalance, 0)}
              />
            )}

            {/* TOTAL ASSETS */}
            <div className="flex justify-between items-center px-5 py-4 bg-primary-600 text-white">
              <span className="font-bold text-base">TOTAL ASSETS</span>
              <span className="font-mono font-bold text-xl">{formatCurrency(data.totalAssets)}</span>
            </div>
          </div>

          {/* ═══ LIABILITIES + EQUITY ═══ */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-red-600 text-white">
              <h2 className="font-bold uppercase tracking-wide text-sm">LIABILITIES & EQUITY</h2>
            </div>

            {/* Current Liabilities */}
            {data.liabilityAccounts.some(a => a.subAccount === 'Current Liabilities') && (
              <BSSection
                title="Current Liabilities"
                accounts={data.liabilityAccounts.filter(a => a.subAccount === 'Current Liabilities')}
                typeOrder={LIAB_TYPE_ORDER}
                isNormalPositive={false}
                headerBg="bg-red-50/60 border-red-100"
                headerColor="text-red-600"
                totalLabel="Total Current Liabilities"
                total={data.liabilityAccounts.filter(a => a.subAccount === 'Current Liabilities').reduce((s, a) => s + (-a.currentBalance), 0)}
              />
            )}

            {/* Short-term Liabilities */}
            {data.liabilityAccounts.some(a => a.subAccount === 'Short-term Liabilities') && (
              <BSSection
                title="Short-term Liabilities"
                accounts={data.liabilityAccounts.filter(a => a.subAccount === 'Short-term Liabilities')}
                typeOrder={LIAB_TYPE_ORDER}
                isNormalPositive={false}
                headerBg="bg-orange-50/60 border-orange-100"
                headerColor="text-orange-600"
                totalLabel="Total Short-term Liabilities"
                total={data.liabilityAccounts.filter(a => a.subAccount === 'Short-term Liabilities').reduce((s, a) => s + (-a.currentBalance), 0)}
              />
            )}

            {/* Long-term Liabilities */}
            {data.liabilityAccounts.some(a => a.subAccount === 'Long-term Liabilities') && (
              <BSSection
                title="Long-term Liabilities"
                accounts={data.liabilityAccounts.filter(a => a.subAccount === 'Long-term Liabilities')}
                typeOrder={LIAB_TYPE_ORDER}
                isNormalPositive={false}
                headerBg="bg-rose-50/60 border-rose-100"
                headerColor="text-rose-700"
                totalLabel="Total Long-term Liabilities"
                total={data.liabilityAccounts.filter(a => a.subAccount === 'Long-term Liabilities').reduce((s, a) => s + (-a.currentBalance), 0)}
              />
            )}

            {/* TOTAL LIABILITIES */}
            <div className="flex justify-between items-center px-5 py-3 bg-red-600 text-white border-b">
              <span className="font-bold">TOTAL LIABILITIES</span>
              <span className="font-mono font-bold text-lg">{formatCurrency(data.totalLiabilities)}</span>
            </div>

            {/* Equity */}
            <div className="px-5 py-2 bg-green-50 border-b border-green-200">
              <span className="text-xs font-bold text-income uppercase tracking-widest">Owner's Equity</span>
            </div>
            {data.equityAccounts.map(acc => {
              // Equity normal = negative balance; positive = abnormal
              const displayVal = -acc.currentBalance;
              const isAbnormal = acc.currentBalance > 0;
              return (
                <div key={acc._id}
                  className="flex justify-between items-center px-5 py-2.5 border-b border-surface-50 hover:bg-surface-50 pl-9">
                  <span className="text-sm text-gray-700">{acc.accountTitle}</span>
                  {isAbnormal
                    ? <span className="font-mono text-sm font-semibold text-expense">({formatCurrency(Math.abs(displayVal))})</span>
                    : <span className="font-mono text-sm font-semibold text-gray-800">{Math.abs(displayVal) > 0.005 ? formatCurrency(displayVal) : '—'}</span>}
                </div>
              );
            })}
            {/* Owner investment subtotal */}
            <div className="flex justify-between items-center px-5 py-2 bg-green-50/60 border-b border-green-100 pl-9">
              <span className="text-xs font-semibold text-gray-500">Owner's Investment (Capital + Revaluation)</span>
              <span className="font-mono text-sm font-bold text-income">{formatCurrency(data.totalEquityBase)}</span>
            </div>
            {/* Net Income */}
            <div className="flex justify-between items-center px-5 py-2.5 border-b border-surface-50 hover:bg-surface-50 pl-9">
              <span className="text-sm text-gray-700 font-medium">Retained Earnings (Net Income)</span>
              <span className={`font-mono text-sm font-semibold ${data.netIncome >= 0 ? 'text-income' : 'text-expense'}`}>
                {data.netIncome < 0
                  ? `(${formatCurrency(Math.abs(data.netIncome))})`
                  : formatCurrency(data.netIncome)}
              </span>
            </div>

            {/* TOTAL EQUITY */}
            <div className="flex justify-between items-center px-5 py-3 bg-income text-white border-b">
              <span className="font-bold">TOTAL EQUITY</span>
              <span className="font-mono font-bold text-lg">{formatCurrency(data.totalEquity)}</span>
            </div>

            {/* GRAND TOTAL */}
            <div className="flex justify-between items-center px-5 py-4 bg-gray-800 text-white">
              <span className="font-bold text-base">TOTAL LIABILITIES + EQUITY</span>
              <span className={`font-mono font-bold text-xl ${data.isBalanced ? 'text-green-300' : 'text-red-300'}`}>
                {formatCurrency(data.totalLiabilities + data.totalEquity)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
