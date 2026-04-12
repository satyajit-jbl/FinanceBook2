import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { formatCurrency, firstDayOfMonth, today } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

// Income Statement layout matches Excel exactly:
// Employment Income → Business Income → Hobby Trading → Investment & Other
// Expenses: Fixed → Household → Business/Hobby → Other → Finance & Banking

const INCOME_ORDER = [
  'Employment Income',
  'Business Income',
  'Freelancing / Hobby Trading Income',
  'Investment & Other Income',
  'Other Income',
];

const EXPENSE_ORDER = [
  'Fixed Expenses',
  'Household Expenses',
  'Business & Hobby Expenses',
  'Other Expenses',
  'Finance & Banking Expenses',
];

function ISRow({ label, amount, indent = false, isMinus = false, bold = false }) {
  return (
    <div className={`flex justify-between items-center px-5 py-2 border-b border-surface-50 hover:bg-surface-50
      ${bold ? 'font-semibold bg-surface-50' : ''} ${indent ? 'pl-10' : ''}`}>
      <span className={`text-sm ${bold ? 'text-gray-800' : 'text-gray-700'}`}>
        {isMinus && <span className="text-gray-400 mr-1">(−)</span>}
        {label}
      </span>
      <span className={`font-mono text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
        {amount !== undefined && amount !== null ? formatCurrency(amount) : '—'}
      </span>
    </div>
  );
}

function SectionTotal({ label, amount, color = 'text-primary-700', bg = 'bg-primary-50' }) {
  return (
    <div className={`flex justify-between items-center px-5 py-3 ${bg} border-b border-surface-200`}>
      <span className={`text-sm font-bold ${color}`}>{label}</span>
      <span className={`font-mono font-bold text-base ${color}`}>{formatCurrency(amount)}</span>
    </div>
  );
}

export default function IncomeStatementPage() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({ startDate: firstDayOfMonth(), endDate: today() });

  const load = async (d = dates) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (d.startDate) qs.set('startDate', d.startDate);
      if (d.endDate)   qs.set('endDate',   d.endDate);
      const { data: res } = await api.get(`/reports/income-statement?${qs}`);
      setData(res);
    } catch { toast.error('Failed to load income statement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Build ordered groups
  const revenueGroups = {};
  const expenseGroups = {};
  if (data) {
    data.revenueAccounts.forEach(r => {
      const k = r.accountType || 'Other';
      if (!revenueGroups[k]) revenueGroups[k] = [];
      revenueGroups[k].push(r);
    });
    data.expenseAccounts.forEach(r => {
      const k = r.accountType || 'Other';
      if (!expenseGroups[k]) expenseGroups[k] = [];
      expenseGroups[k].push(r);
    });
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income Statement</h1>
          <p className="text-gray-400 text-sm">Profit & Loss · {dates.startDate || 'All'} → {dates.endDate || 'Today'}</p>
        </div>
        <button onClick={() => window.print()} className="btn btn-secondary no-print">🖨 Print</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end no-print">
        <div><label className="label">From</label>
          <input type="date" className="input" value={dates.startDate} onChange={e => setDates(d => ({ ...d, startDate: e.target.value }))} />
        </div>
        <div><label className="label">To</label>
          <input type="date" className="input" value={dates.endDate} onChange={e => setDates(d => ({ ...d, endDate: e.target.value }))} />
        </div>
        <button onClick={() => load(dates)} className="btn-primary">Apply</button>
        <button onClick={() => { const d = { startDate: '', endDate: '' }; setDates(d); load(d); }} className="btn btn-secondary">All Time</button>
      </div>

      {/* Net Income Banner */}
      {data && (
        <div className={`p-5 rounded-xl border-2 flex items-center justify-between
          ${data.netIncome >= 0 ? 'bg-income-light border-income/40' : 'bg-expense-light border-expense/40'}`}>
          <div>
            <p className="text-sm font-semibold text-gray-600">{data.netIncome >= 0 ? '📈 Net Income (After Tax)' : '📉 Net Loss'}</p>
            <p className={`text-3xl font-bold font-mono mt-1 ${data.netIncome >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatCurrency(data.netIncome)}
            </p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p className="text-gray-500">Total Revenue: <strong className="text-income font-mono">{formatCurrency(data.totalRevenue)}</strong></p>
            <p className="text-gray-500">Total Expenses: <strong className="text-expense font-mono">{formatCurrency(data.totalExpenses)}</strong></p>
            <p className="text-gray-500">Net Before Tax: <strong className="font-mono">{formatCurrency(data.netIncomeBeforeTax)}</strong></p>
            <p className="text-gray-500">Income Tax: <strong className="text-expense font-mono">{formatCurrency(data.incomeTax)}</strong></p>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : data && (
        <div className="card overflow-hidden">
          {/* ── INCOME ── */}
          <div className="px-5 py-3 bg-income-light border-b border-income/20">
            <h2 className="font-bold text-income text-base uppercase tracking-wide">Income</h2>
          </div>

          {INCOME_ORDER.filter(g => revenueGroups[g]).map(group => {
            const rows = revenueGroups[group] || [];
            const subtotal = rows.reduce((s, r) => s + r.displayAmount, 0);
            if (!subtotal && rows.every(r => r.displayAmount === 0)) return null;
            return (
              <div key={group}>
                <div className="px-5 py-1.5 bg-green-50/50 border-b border-green-100">
                  <span className="text-xs font-bold text-income uppercase tracking-wide">{group}</span>
                </div>
                {rows.map(r => (
                  <ISRow key={r._id} label={r.accountTitle}
                    amount={r.displayAmount}
                    isMinus={r.displayAmount < 0}
                    indent />
                ))}
                <SectionTotal label={`Total ${group}`} amount={subtotal} color="text-income" bg="bg-green-50" />
              </div>
            );
          })}

          {/* Total Income */}
          <div className="flex justify-between items-center px-5 py-4 bg-income text-white">
            <span className="font-bold text-base">TOTAL INCOME</span>
            <span className="font-mono font-bold text-lg">{formatCurrency(data.totalRevenue)}</span>
          </div>

          {/* ── EXPENSES ── */}
          <div className="px-5 py-3 bg-expense-light border-b border-expense/20 mt-1">
            <h2 className="font-bold text-expense text-base uppercase tracking-wide">Expenses</h2>
          </div>

          {EXPENSE_ORDER.filter(g => expenseGroups[g]).map(group => {
            const rows = expenseGroups[group] || [];
            const subtotal = rows.reduce((s, r) => s + r.displayAmount, 0);
            return (
              <div key={group}>
                <div className="px-5 py-1.5 bg-red-50/50 border-b border-red-100">
                  <span className="text-xs font-bold text-expense uppercase tracking-wide">{group}</span>
                </div>
                {rows.map(r => (
                  <ISRow key={r._id} label={r.accountTitle} amount={r.displayAmount} indent />
                ))}
                <SectionTotal label={`Total ${group}`} amount={subtotal} color="text-expense" bg="bg-red-50" />
              </div>
            );
          })}

          <div className="flex justify-between items-center px-5 py-4 bg-expense text-white">
            <span className="font-bold text-base">TOTAL EXPENSES</span>
            <span className="font-mono font-bold text-lg">{formatCurrency(data.totalExpenses)}</span>
          </div>

          {/* Net Income lines */}
          <div className="flex justify-between items-center px-5 py-3.5 bg-surface-50 border-t border-surface-200">
            <span className="font-bold text-gray-800">Net Income Before Tax</span>
            <span className="font-mono font-bold text-gray-900">{formatCurrency(data.netIncomeBeforeTax)}</span>
          </div>
          <div className="flex justify-between items-center px-5 py-2.5 border-b border-surface-100 pl-10">
            <span className="text-sm text-gray-600">(−) Income Tax</span>
            <span className="font-mono text-sm text-expense">{formatCurrency(data.incomeTax)}</span>
          </div>
          <div className={`flex justify-between items-center px-5 py-5 ${data.netIncome >= 0 ? 'bg-gray-900' : 'bg-gray-700'} text-white`}>
            <span className="font-bold text-lg">NET INCOME (AFTER TAX)</span>
            <span className={`font-mono font-bold text-2xl ${data.netIncome >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {formatCurrency(Math.abs(data.netIncome))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
