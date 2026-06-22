import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import {
  formatCurrency, formatDate, formatDateTime, txnTypeLabel, txnTypeColor,
} from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const ACTION_LABEL = {
  posted: 'Posted',
  edited: 'Edited',
  voided: 'Voided',
};

const ACTION_STYLE = {
  posted: 'bg-green-50 text-green-700',
  edited: 'bg-amber-50 text-amber-700',
  voided: 'bg-red-50 text-red-600',
};

export default function AuditTrailPage() {
  const [events, setEvents]       = useState([]);
  const [summary, setSummary]     = useState({ total: 0, posted: 0, edited: 0, voided: 0 });
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({
    startDate: '',
    endDate: '',
    action: 'all',
  });
  const [detailModal, setDetailModal] = useState(null);
  const [detailTxn, setDetailTxn]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate)   params.set('endDate', filters.endDate);
      if (filters.action !== 'all') params.set('action', filters.action);
      const { data } = await api.get(`/reports/audit-trail?${params}`);
      const evts = data.events || [];
      setEvents(evts);
      setSummary(data.summary || {
        total:  evts.length,
        posted: evts.filter(e => e.action === 'posted').length,
        edited: evts.filter(e => e.action === 'edited').length,
        voided: evts.filter(e => e.action === 'voided').length,
      });
    } catch {
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (event) => {
    setDetailModal(event);
    setDetailTxn(null);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/transactions/${event.transactionId}`);
      setDetailTxn(data.transaction);
    } catch {
      toast.error('Failed to load transaction detail');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-gray-400 text-sm">
            Posted, edited, and voided transactions — who did what and when
          </p>
        </div>
        <button onClick={() => window.print()} className="btn btn-secondary no-print">🖨 Print</button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end no-print">
        <div>
          <label className="label">From (event date)</label>
          <input type="date" className="input" value={filters.startDate}
            onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
          <p className="text-[10px] text-gray-400 mt-0.5">Leave empty for no start limit</p>
        </div>
        <div>
          <label className="label">To (event date)</label>
          <input type="date" className="input" value={filters.endDate}
            onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
          <p className="text-[10px] text-gray-400 mt-0.5">Leave empty for no end limit</p>
        </div>
        <div>
          <label className="label">Action</label>
          <select className="input w-40" value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
            <option value="all">All actions</option>
            <option value="posted">Posted only</option>
            <option value="edited">Edited only</option>
            <option value="voided">Voided only</option>
          </select>
        </div>
        <button onClick={load} className="btn-primary">Apply</button>
        <button onClick={() => { setFilters(f => ({ ...f, startDate: '', endDate: '' })); }} className="btn btn-secondary">Show All</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total events</p>
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Posted</p>
          <p className="text-2xl font-bold text-green-700">{summary.posted}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Edited</p>
          <p className="text-2xl font-bold text-amber-600">{summary.edited}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Voided</p>
          <p className="text-2xl font-bold text-red-600">{summary.voided}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Event Date/Time</th>
              <th className="table-th">Action</th>
              <th className="table-th">Txn Date</th>
              <th className="table-th">Type</th>
              <th className="table-th">Description</th>
              <th className="table-th text-right">Amount</th>
              <th className="table-th">User</th>
              <th className="table-th">Reason</th>
              <th className="table-th no-print"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-12"><LoadingSpinner /></td></tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState icon="📋" title="No audit events" description="Try a wider date range or different action filter." />
                </td>
              </tr>
            ) : events.map((ev, i) => (
              <tr key={`${ev.transactionId}-${ev.action}-${ev.occurredAt}-${i}`} className="hover:bg-surface-50">
                <td className="table-td text-xs whitespace-nowrap">{formatDateTime(ev.occurredAt)}</td>
                <td className="table-td">
                  <span className={`badge ${ACTION_STYLE[ev.action]}`}>{ACTION_LABEL[ev.action]}</span>
                </td>
                <td className="table-td text-xs">{formatDate(ev.transactionDate)}</td>
                <td className="table-td">
                  <span className={`badge ${txnTypeColor(ev.transactionType)}`}>{txnTypeLabel(ev.transactionType)}</span>
                </td>
                <td className="table-td max-w-xs">
                  <p className="truncate font-medium">{ev.description}</p>
                  {ev.reference && <p className="text-xs text-gray-400">Ref: {ev.reference}</p>}
                </td>
                <td className="table-td text-right font-mono font-semibold">{formatCurrency(ev.amount)}</td>
                <td className="table-td text-xs">
                  <p className="font-medium text-gray-800">{ev.performedByName}</p>
                  {ev.performedByEmail && <p className="text-gray-400 truncate max-w-[120px]">{ev.performedByEmail}</p>}
                </td>
                <td className="table-td text-xs text-gray-600 max-w-[160px]">
                  {ev.reason ? <span className="line-clamp-2">{ev.reason}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="table-td no-print">
                  <button onClick={() => openDetail(ev)} className="text-xs text-primary-600 hover:underline font-medium">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      <Modal open={!!detailModal} onClose={() => { setDetailModal(null); setDetailTxn(null); }}
        title="Audit Event Detail" size="lg">
        {detailModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Action:</span>{' '}
                <span className={`badge ${ACTION_STYLE[detailModal.action]}`}>{ACTION_LABEL[detailModal.action]}</span>
              </div>
              <div><span className="text-gray-400">When:</span> <strong>{formatDateTime(detailModal.occurredAt)}</strong></div>
              <div><span className="text-gray-400">By:</span> <strong>{detailModal.performedByName}</strong></div>
              <div><span className="text-gray-400">Txn date:</span> <strong>{formatDate(detailModal.transactionDate)}</strong></div>
              {detailModal.reason && (
                <div className="col-span-2 p-2 bg-gray-50 rounded text-sm">
                  <span className="text-gray-400">Reason: </span>{detailModal.reason}
                </div>
              )}
            </div>

            {detailLoading ? (
              <LoadingSpinner />
            ) : detailTxn ? (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-th">Account</th>
                      <th className="table-th text-right">Debit</th>
                      <th className="table-th text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailTxn.journalEntries?.map((e, idx) => (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="py-2 px-4">{e.accountTitle}</td>
                        <td className="py-2 px-4 text-right font-mono">{e.debit > 0 ? formatCurrency(e.debit) : '—'}</td>
                        <td className="py-2 px-4 text-right font-mono">{e.credit > 0 ? formatCurrency(e.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailTxn.status !== 'void' && (
                  <div className="flex justify-end">
                    <Link to={`/transactions/${detailTxn._id}/edit`} className="btn btn-secondary btn-sm">
                      ✏️ Edit Transaction
                    </Link>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
