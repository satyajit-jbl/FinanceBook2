import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function LedgerPage() {
  const { id } = useParams();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates]     = useState({ startDate: '', endDate: '' });

  const load = useCallback(async (d = dates) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (d.startDate) qs.set('startDate', d.startDate);
      if (d.endDate)   qs.set('endDate',   d.endDate);
      const { data: res } = await api.get(`/accounts/${id}/ledger?${qs}`);
      setData(res);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLoading(false); }
  }, [id, dates]);

  useEffect(() => { load(); }, [id]);

  const account        = data?.account;
  const openingBalance = data?.openingBalance ?? 0;
  const closingBalance = data?.closingBalance ?? 0;
  const totalDebit     = data?.totalDebit ?? 0;
  const totalCredit    = data?.totalCredit ?? 0;
  const ledger         = data?.ledger ?? [];

  const balanceLabel = (bal) =>
    `${formatCurrency(Math.abs(bal))} ${bal > 0 ? 'Dr' : bal < 0 ? 'Cr' : ''}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <Link to="/accounts" className="text-xs text-primary-600 hover:underline mb-1 block">
            ← Chart of Accounts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {account?.accountTitle || 'Account Ledger'}
          </h1>
          <p className="text-gray-400 text-sm">
            {account?.accountType} · {account?.subAccount} · {account?.financialStatement}
            {account?.accountNo ? ` · #${account.accountNo}` : ''}
          </p>
        </div>
        <button onClick={() => window.print()} className="btn btn-secondary no-print">🖨 Print</button>
      </div>

      {/* Summary cards */}
      {account && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="label">Opening Balance</p>
            <p className={`font-mono font-bold text-lg ${openingBalance >= 0 ? 'text-primary-700' : 'text-income'}`}>
              {balanceLabel(openingBalance)}
            </p>
          </div>
          <div className="card p-4">
            <p className="label">Total Debit (Dr)</p>
            <p className="font-mono font-bold text-lg text-primary-700">{formatCurrency(totalDebit)}</p>
          </div>
          <div className="card p-4">
            <p className="label">Total Credit (Cr)</p>
            <p className="font-mono font-bold text-lg text-income">{formatCurrency(totalCredit)}</p>
          </div>
          <div className="card p-4">
            <p className="label">Closing Balance</p>
            <p className={`font-mono font-bold text-lg ${closingBalance >= 0 ? 'text-primary-700' : 'text-income'}`}>
              {balanceLabel(closingBalance)}
            </p>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div className="card p-4 flex flex-wrap gap-3 items-end no-print">
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input"
            value={dates.startDate}
            onChange={e => setDates(d => ({ ...d, startDate: e.target.value }))} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input"
            value={dates.endDate}
            onChange={e => setDates(d => ({ ...d, endDate: e.target.value }))} />
        </div>
        <button onClick={() => load(dates)} className="btn-primary">Apply</button>
        <button
          onClick={() => { const d = { startDate: '', endDate: '' }; setDates(d); load(d); }}
          className="btn btn-secondary">
          All Time
        </button>
      </div>

      {/* Ledger table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Transaction History</h3>
          <span className="text-xs text-gray-400">{ledger.length} entries</span>
        </div>

        {loading ? <LoadingSpinner /> : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Description</th>
                <th className="table-th hidden md:table-cell">Ref</th>
                <th className="table-th text-right">Debit (Dr)</th>
                <th className="table-th text-right">Credit (Cr)</th>
                <th className="table-th text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr className="bg-blue-50/60 border-b border-blue-100">
                <td className="table-td text-xs font-medium text-blue-500">—</td>
                <td className="table-td text-sm font-semibold text-blue-700">Opening Balance</td>
                <td className="table-td hidden md:table-cell text-xs text-gray-300">—</td>
                <td className="table-td text-right text-gray-300">—</td>
                <td className="table-td text-right text-gray-300">—</td>
                <td className="table-td text-right font-mono font-bold text-blue-700">
                  {balanceLabel(openingBalance)}
                </td>
              </tr>

              {/* Transaction rows */}
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="📄" title="No transactions in this period"
                      description="Try expanding the date range or select 'All Time'" />
                  </td>
                </tr>
              ) : ledger.map((row, i) => (
                <tr key={i} className="hover:bg-surface-50 transition-colors border-b border-surface-50">
                  <td className="table-td text-xs font-medium whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="table-td">
                    <p className="text-sm font-medium text-gray-800">{row.description}</p>
                  </td>
                  <td className="table-td hidden md:table-cell text-xs text-gray-400">
                    {row.reference || '—'}
                  </td>
                  <td className="table-td text-right font-mono text-sm">
                    {row.debit > 0
                      ? <span className="font-semibold text-primary-700">{formatCurrency(row.debit)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td text-right font-mono text-sm">
                    {row.credit > 0
                      ? <span className="font-semibold text-income">{formatCurrency(row.credit)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td text-right font-mono font-semibold">
                    <span className={row.balance >= 0 ? 'text-primary-700' : 'text-income'}>
                      {balanceLabel(row.balance)}
                    </span>
                  </td>
                </tr>
              ))}

              {/* Closing balance footer row */}
              {ledger.length > 0 && (
                <tr className="bg-surface-100 border-t-2 border-surface-300">
                  <td className="table-td font-bold text-xs uppercase tracking-wide text-gray-500"
                    colSpan={3}>Closing Balance</td>
                  <td className="table-td text-right font-mono font-bold text-primary-700">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="table-td text-right font-mono font-bold text-income">
                    {formatCurrency(totalCredit)}
                  </td>
                  <td className="table-td text-right font-mono font-bold text-lg">
                    <span className={closingBalance >= 0 ? 'text-primary-700' : 'text-income'}>
                      {balanceLabel(closingBalance)}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
