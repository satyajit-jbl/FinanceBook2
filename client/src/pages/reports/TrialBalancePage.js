import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import { formatCurrency, today, subAccountColor } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const SUB_ORDER = [
  'Current Assets','Investments','Fixed Assets',
  'Current Liabilities','Short-term Liabilities','Long-term Liabilities',
  'Equity','Revenue','Expenses',
];

// Helper: format amount for a Dr or Cr cell — show value or dash
const F  = (v) => v > 0.005 ? formatCurrency(v) : null;
const Cell = ({ val, color = 'text-gray-800' }) =>
  val ? <span className={`font-mono font-semibold ${color}`}>{val}</span>
      : <span className="text-gray-200 select-none">—</span>;

export default function TrialBalancePage() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [asOfDate,   setAsOfDate]   = useState(today());
  const [filterSub,  setFilterSub]  = useState('');
  const [search,     setSearch]     = useState('');

  const load = useCallback(async (date = asOfDate) => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/reports/trial-balance?asOfDate=${date}`);
      setData(res);
    } catch { toast.error('Failed to load trial balance'); }
    finally { setLoading(false); }
  }, [asOfDate]);

  useEffect(() => { load(); }, []);

  const rows = (data?.rows || []).filter(r =>
    (!filterSub || r.subAccount === filterSub) &&
    (!search    || r.accountTitle.toLowerCase().includes(search.toLowerCase()))
  );
  const visibleSubs = SUB_ORDER.filter(s => rows.some(r => r.subAccount === s));

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial Balance</h1>
          <p className="text-gray-400 text-sm">As of {asOfDate}</p>
        </div>
        <button onClick={() => window.print()} className="btn btn-secondary no-print">🖨 Print</button>
      </div>

      {/* ── Controls ── */}
      <div className="card p-4 flex flex-wrap gap-3 items-end no-print">
        <div>
          <label className="label">As Of Date</label>
          <input type="date" className="input" value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input w-44" value={filterSub} onChange={e => setFilterSub(e.target.value)}>
            <option value="">All</option>
            {SUB_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Search</label>
          <input className="input w-48" placeholder="Account name…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => load(asOfDate)} className="btn-primary">Apply</button>
        {(filterSub || search) && (
          <button onClick={() => { setFilterSub(''); setSearch(''); }} className="btn btn-secondary">Clear</button>
        )}
      </div>

      {/* ── Balance status banner ── */}
      {data && (
        <div className={`p-4 rounded-xl border flex items-center gap-3
          ${data.isBalanced
            ? 'bg-income-light border-income/30 text-income'
            : 'bg-expense-light border-expense/30 text-expense'}`}>
          <span className="text-2xl">{data.isBalanced ? '✓' : '⚠️'}</span>
          <div className="flex-1">
            <p className="font-bold">
              {data.isBalanced
                ? 'Trial Balance is Balanced — Present Balance Grand Total = 0 ✓'
                : 'Trial Balance is NOT balanced'}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              Opening Dr: {formatCurrency(data.grandOpenDr)} | Opening Cr: {formatCurrency(data.grandOpenCr)}
              &nbsp;&nbsp;·&nbsp;&nbsp;
              Txn Dr: {formatCurrency(data.grandTxnDr)} | Txn Cr: {formatCurrency(data.grandTxnCr)}
              &nbsp;&nbsp;·&nbsp;&nbsp;
              Present Dr: {formatCurrency(data.grandPresDr)} | Present Cr: {formatCurrency(data.grandPresCr)}
            </p>
          </div>
          <span className="text-xs opacity-60">{(data.rows || []).length} accounts</span>
        </div>
      )}

      {/* ── Main table ── */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            {/* Column group headers */}
            <tr className="bg-gray-800 text-white">
              <th className="px-4 py-2 text-left text-xs font-semibold" rowSpan={2}>#</th>
              <th className="px-4 py-2 text-left text-xs font-semibold" rowSpan={2}>Account Title</th>
              <th className="px-4 py-2 text-left text-xs font-semibold hidden md:table-cell" rowSpan={2}>A/C No.</th>
              {/* Opening Balance group */}
              <th className="px-4 py-2 text-center text-xs font-semibold border-l border-gray-600"
                colSpan={2}>Opening Balance</th>
              {/* Transaction group */}
              <th className="px-4 py-2 text-center text-xs font-semibold border-l border-gray-600"
                colSpan={2}>Transactions</th>
              {/* Present Balance group */}
              <th className="px-4 py-2 text-center text-xs font-semibold border-l border-gray-600"
                colSpan={2}>Present Balance</th>
            </tr>
            <tr className="bg-gray-700 text-white text-xs">
              <th className="px-4 py-1.5 text-right font-medium border-l border-gray-600 text-blue-200">Dr</th>
              <th className="px-4 py-1.5 text-right font-medium text-green-200">Cr</th>
              <th className="px-4 py-1.5 text-right font-medium border-l border-gray-600 text-blue-200">Dr</th>
              <th className="px-4 py-1.5 text-right font-medium text-green-200">Cr</th>
              <th className="px-4 py-1.5 text-right font-medium border-l border-gray-600 text-blue-200">Dr</th>
              <th className="px-4 py-1.5 text-right font-medium text-green-200">Cr</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12"><LoadingSpinner /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9}><EmptyState icon="📄" title="No accounts found" /></td></tr>
            ) : (() => {
              let seq = 0;
              return visibleSubs.map(sub => {
                const subRows = rows.filter(r => r.subAccount === sub);
                if (!subRows.length) return null;

                // Sub-totals
                const subOpenDr = subRows.reduce((s, r) => s + r.openDr, 0);
                const subOpenCr = subRows.reduce((s, r) => s + r.openCr, 0);
                const subTxnDr  = subRows.reduce((s, r) => s + r.txnDebit,  0);
                const subTxnCr  = subRows.reduce((s, r) => s + r.txnCredit, 0);
                const subPresDr = subRows.reduce((s, r) => s + r.presDr, 0);
                const subPresCr = subRows.reduce((s, r) => s + r.presCr, 0);

                return (
                  <React.Fragment key={sub}>
                    {/* Category header */}
                    <tr>
                      <td colSpan={9}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b border-t border-surface-200 bg-surface-50 ${subAccountColor(sub)}`}>
                        {sub}
                      </td>
                    </tr>

                    {/* Account rows */}
                    {subRows.map(row => {
                      seq++;
                      return (
                        <tr key={row._id}
                          className="border-b border-surface-50 hover:bg-surface-50/80 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-gray-300 text-center w-8">{seq}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{row.accountTitle}</td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-400 font-mono">
                            {row.accountNo || '—'}
                          </td>
                          {/* Opening Balance */}
                          <td className="px-4 py-2.5 text-right border-l border-surface-100">
                            <Cell val={F(row.openDr)} color="text-primary-700" />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Cell val={F(row.openCr)} color="text-income" />
                          </td>
                          {/* Transactions */}
                          <td className="px-4 py-2.5 text-right border-l border-surface-100">
                            <Cell val={F(row.txnDebit)} color="text-primary-600" />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Cell val={F(row.txnCredit)} color="text-emerald-600" />
                          </td>
                          {/* Present Balance */}
                          <td className="px-4 py-2.5 text-right border-l border-surface-100">
                            <Cell val={F(row.presDr)} color="text-primary-700" />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Cell val={F(row.presCr)} color="text-income" />
                          </td>
                        </tr>
                      );
                    })}

                    {/* Sub-total row */}
                    <tr className="bg-surface-50 border-b border-surface-200">
                      <td colSpan={3}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${subAccountColor(sub)}`}>
                        Subtotal — {sub}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-primary-700 border-l border-surface-200">
                        {F(subOpenDr) || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-income">
                        {F(subOpenCr) || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-primary-600 border-l border-surface-200">
                        {F(subTxnDr) || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">
                        {F(subTxnCr) || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-primary-700 border-l border-surface-200">
                        {F(subPresDr) || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-income">
                        {F(subPresCr) || '—'}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              });
            })()}
          </tbody>

          {/* Grand Total footer */}
          {data && !loading && (
            <tfoot>
              <tr className="bg-gray-900 text-white">
                <td className="px-4 py-3 font-bold text-sm" colSpan={3}>
                  GRAND TOTAL ({(data.rows || []).length} accounts)
                </td>
                {/* Opening */}
                <td className="px-4 py-3 text-right font-mono font-bold border-l border-gray-700">
                  {formatCurrency(data.grandOpenDr)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  {formatCurrency(data.grandOpenCr)}
                </td>
                {/* Transactions */}
                <td className="px-4 py-3 text-right font-mono font-bold border-l border-gray-700">
                  {formatCurrency(data.grandTxnDr)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  {formatCurrency(data.grandTxnCr)}
                </td>
                {/* Present Balance */}
                <td className={`px-4 py-3 text-right font-mono font-bold border-l border-gray-700
                  ${data.isBalanced ? 'text-green-300' : 'text-red-300'}`}>
                  {formatCurrency(data.grandPresDr)}
                </td>
                <td className={`px-4 py-3 text-right font-mono font-bold
                  ${data.isBalanced ? 'text-green-300' : 'text-red-300'}`}>
                  {formatCurrency(data.grandPresCr)}
                </td>
              </tr>
              {!data.isBalanced && (
                <tr className="bg-expense-light">
                  <td colSpan={9}
                    className="px-4 py-2 text-center text-xs text-expense font-semibold">
                    ⚠️ Present Balance is not balanced — Difference: {formatCurrency(Math.abs(data.grandTotal))}
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Summary cards ── */}
      {data && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          {[
            { label: 'Opening Balance (Dr)',  val: data.grandOpenDr,  color: 'text-primary-700' },
            { label: 'Opening Balance (Cr)',  val: data.grandOpenCr,  color: 'text-income'      },
            { label: 'Present Balance (Dr)',  val: data.grandPresDr,  color: 'text-primary-700' },
            { label: 'Present Balance (Cr)',  val: data.grandPresCr,  color: data.isBalanced ? 'text-income' : 'text-expense' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`font-mono font-bold text-lg ${s.color}`}>
                {formatCurrency(s.val)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
