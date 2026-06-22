import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate, txnTypeLabel, txnTypeColor, firstDayOfMonth, today } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', startDate: firstDayOfMonth(), endDate: today() });
  const [voidModal, setVoidModal] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);
  const [detailModal, setDetailModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.type) params.set('type', filters.type);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      const { data } = await api.get(`/transactions?${params}`);
      setTransactions(data.transactions);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const handleVoid = async () => {
    if (!voidReason.trim()) { toast.error('Please enter a void reason'); return; }
    setVoidLoading(true);
    try {
      await api.post(`/transactions/${voidModal._id}/void`, { reason: voidReason });
      toast.success('Transaction voided successfully');
      setVoidModal(null);
      setVoidReason('');
      load();
    } catch (err) { toast.error(err.message || 'Void failed'); }
    finally { setVoidLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-400 text-sm">{total} total entries</p>
        </div>
        <Link to="/transactions/new" className="btn-primary">+ New Transaction</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-2 md:gap-3 items-end">
        <div>
          <label className="label">Type</label>
          <select className="input w-48" value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}>
            <option value="">All Types</option>
            <option value="cash_receive">Cash Receive</option>
            <option value="cash_payment">Cash Payment</option>
            <option value="fund_transfer">Fund Transfer</option>
            <option value="multiple_fund_transfer">Multiple Transfer</option>
          </select>
        </div>
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input" value={filters.startDate} onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value })); setPage(1); }} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input" value={filters.endDate} onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value })); setPage(1); }} />
        </div>
        <button onClick={() => { setFilters({ type: '', startDate: '', endDate: '' }); setPage(1); }} className="btn btn-secondary btn-sm">Clear</button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Date</th>
              <th className="table-th">Type</th>
              <th className="table-th">Description</th>
              <th className="table-th">Entries</th>
              <th className="table-th text-right">Amount</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12"><LoadingSpinner /></td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={7}><EmptyState icon="📄" title="No transactions found" description="Try adjusting your filters or create a new transaction." /></td></tr>
            ) : transactions.map(txn => (
              <tr key={txn._id} className={`hover:bg-surface-50 transition-colors ${txn.status === 'void' ? 'opacity-50' : ''}`}>
                <td className="table-td text-xs font-medium">{formatDate(txn.date)}</td>
                <td className="table-td"><span className={`badge ${txnTypeColor(txn.transactionType)}`}>{txnTypeLabel(txn.transactionType)}</span></td>
                <td className="table-td max-w-xs">
                  <p className="truncate font-medium text-gray-800">{txn.description}</p>
                  {txn.reference && <p className="text-xs text-gray-400">Ref: {txn.reference}</p>}
                </td>
                <td className="table-td text-xs text-gray-500">{txn.journalEntries?.length || 2} lines</td>
                <td className="table-td text-right font-mono font-semibold">{formatCurrency(txn.totalAmount)}</td>
                <td className="table-td">
                  <span className={`badge ${txn.status === 'void' ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'}`}>
                    {txn.status === 'void' ? 'Voided' : 'Posted'}
                  </span>
                  {txn.status !== 'void' && (txn.editHistory?.length > 0 || txn.editedAt) && (
                    <span className="ml-1 badge bg-amber-50 text-amber-700 text-[10px]">
                      ✏️ {txn.editHistory?.length || 1}
                    </span>
                  )}
                </td>
                <td className="table-td">
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setDetailModal(txn)} className="text-xs text-primary-600 hover:underline font-medium">View</button>
                    {txn.status !== 'void' && (
                      <>
                        <Link to={`/transactions/${txn._id}/edit`} className="text-xs text-amber-600 hover:underline font-medium">Edit</Link>
                        <button onClick={() => { setVoidModal(txn); setVoidReason(''); }} className="text-xs text-red-500 hover:underline font-medium">Void</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-sm">← Prev</button>
          <span className="btn btn-secondary btn-sm pointer-events-none">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn btn-secondary btn-sm">Next →</button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Transaction Detail" size="lg">
        {detailModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Date:</span> <strong>{formatDate(detailModal.date)}</strong></div>
              <div><span className="text-gray-400">Type:</span> <span className={`badge ${txnTypeColor(detailModal.transactionType)}`}>{txnTypeLabel(detailModal.transactionType)}</span></div>
              <div className="col-span-2"><span className="text-gray-400">Description:</span> <strong>{detailModal.description}</strong></div>
              {detailModal.reference && <div className="col-span-2"><span className="text-gray-400">Reference:</span> {detailModal.reference}</div>}
              {detailModal.editedAt && (
                <div className="col-span-2 p-2 bg-amber-50 rounded text-amber-800 text-xs">
                  Edited {detailModal.editHistory?.length || 1} time{(detailModal.editHistory?.length || 1) !== 1 ? 's' : ''}
                  {' — '}Last: {formatDate(detailModal.editedAt)}
                  {detailModal.editReason && <> — {detailModal.editReason}</>}
                </div>
              )}
              {detailModal.status === 'void' && <div className="col-span-2 p-2 bg-red-50 rounded text-red-700 text-xs">Voided: {detailModal.voidReason}</div>}
            </div>
            <table className="w-full text-sm">
              <thead><tr><th className="table-th">Account</th><th className="table-th text-right">Debit</th><th className="table-th text-right">Credit</th></tr></thead>
              <tbody>
                {detailModal.journalEntries?.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-4">{e.accountTitle}</td>
                    <td className="py-2 px-4 text-right font-mono">{e.debit > 0 ? formatCurrency(e.debit) : '—'}</td>
                    <td className="py-2 px-4 text-right font-mono">{e.credit > 0 ? formatCurrency(e.credit) : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-2 px-4 text-xs uppercase tracking-wide text-gray-500">Total</td>
                  <td className="py-2 px-4 text-right font-mono text-primary-700">{formatCurrency(detailModal.totalAmount)}</td>
                  <td className="py-2 px-4 text-right font-mono text-primary-700">{formatCurrency(detailModal.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
            {detailModal.status !== 'void' && (
              <div className="flex justify-end pt-2">
                <Link to={`/transactions/${detailModal._id}/edit`} className="btn btn-secondary btn-sm">✏️ Edit Transaction</Link>
              </div>
            )}
            {detailModal.editHistory?.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Edit History</p>
                <ul className="space-y-1.5">
                  {detailModal.editHistory.map((h, i) => (
                    <li key={h._id || i} className="text-xs text-gray-600 bg-amber-50 rounded px-2 py-1.5">
                      <span className="font-medium">{formatDate(h.editedAt)}</span>
                      {h.editReason && <> — {h.editReason}</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Void Modal */}
      <Modal open={!!voidModal} onClose={() => setVoidModal(null)} title="Void Transaction" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ Voiding will reverse all journal entries. This cannot be undone.
          </div>
          <div>
            <label className="label">Void Reason *</label>
            <textarea className="input resize-none" rows={3} placeholder="Enter reason for voiding..." value={voidReason} onChange={e => setVoidReason(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn btn-secondary" onClick={() => setVoidModal(null)} disabled={voidLoading}>Cancel</button>
            <button className="btn btn-danger" onClick={handleVoid} disabled={voidLoading}>{voidLoading ? 'Voiding...' : 'Void Transaction'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
