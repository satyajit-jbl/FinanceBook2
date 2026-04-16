import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, subAccountColor } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

const TYPE_TO_SUB = {
  'Cash': 'Current Assets',
  'Savings Bank Account': 'Current Assets',
  'Digital Wallet': 'Current Assets',
  'Fixed Deposit Account': 'Current Assets',
  'DPS Account': 'Current Assets',
  'Accounts Receivable (Lending)': 'Current Assets',
  'Savings Certificate': 'Investments',
  'investment': 'Investments',
  'Insurence': 'Investments',
  'Share': 'Investments',
  'Other account': 'Investments',
  'Investment': 'Investments',
  'Fixed Assets': 'Fixed Assets',
  'Credit Card': 'Current Liabilities',
  'Borrowings': 'Current Liabilities',
  'Other': 'Current Liabilities',
  'Short-term Loans': 'Short-term Liabilities',
  'Long-term Liabilities': 'Long-term Liabilities',
  'Equity': 'Equity',
  'Employment Income': 'Revenue',
  'Business Income': 'Revenue',
  'Freelancing / Hobby Trading Income': 'Revenue',
  'Investment & Other Income': 'Revenue',
  'Other Income': 'Revenue',
  'Fixed Expenses': 'Expenses',
  'Household Expenses': 'Expenses',
  'Business & Hobby Expenses': 'Expenses',
  'Other Expenses': 'Expenses',
  'Finance & Banking Expenses': 'Expenses',
};

const SUB_TO_FS = {
  'Current Assets': 'Balance Sheet',
  'Investments': 'Balance Sheet',
  'Fixed Assets': 'Balance Sheet',
  'Current Liabilities': 'Balance Sheet',
  'Short-term Liabilities': 'Balance Sheet',
  'Long-term Liabilities': 'Balance Sheet',
  'Equity': 'Balance Sheet',
  'Revenue': 'Income Statement',
  'Expenses': 'Income Statement',
};

const ACCOUNT_TYPES_GROUPED = [
  { group: 'Cash & Bank', types: ['Cash', 'Savings Bank Account', 'Digital Wallet', 'Fixed Deposit Account', 'DPS Account'] },
  { group: 'Receivables', types: ['Accounts Receivable (Lending)'] },
  { group: 'Investments', types: ['Savings Certificate', 'investment', 'Insurence', 'Share', 'Other account', 'Investment'] },
  { group: 'Fixed Assets', types: ['Fixed Assets'] },
  { group: 'Liabilities', types: ['Credit Card', 'Borrowings', 'Other', 'Short-term Loans', 'Long-term Liabilities'] },
  { group: 'Equity', types: ['Equity'] },
  { group: 'Income', types: ['Employment Income', 'Business Income', 'Freelancing / Hobby Trading Income', 'Investment & Other Income', 'Other Income'] },
  { group: 'Expenses', types: ['Fixed Expenses', 'Household Expenses', 'Business & Hobby Expenses', 'Other Expenses', 'Finance & Banking Expenses'] },
];

const EMPTY_FORM = { accountTitle: '', accountNo: '', accountType: '', subAccount: '', financialStatement: '', isCashAccount: false };
const SUB_ORDER = ['Current Assets', 'Investments', 'Fixed Assets', 'Current Liabilities', 'Short-term Liabilities', 'Long-term Liabilities', 'Equity', 'Revenue', 'Expenses'];

// ── Seed confirmation modal
function SeedModal({ open, onClose, onConfirm, loading, result }) {
  return (
    <Modal open={open} onClose={!loading ? onClose : undefined} title="Seed Chart of Accounts" size="md">
      {result ? (
        // Post-seed result screen
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border-2 ${result.balanced ? 'bg-income-light border-income/40' : 'bg-warning-light border-warning/40'}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{result.balanced ? '✅' : '⚠️'}</span>
              <p className="font-bold text-gray-900">{result.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Accounts Created</p>
                <p className="font-bold text-2xl text-primary-700">{result.inserted}</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Total Accounts</p>
                <p className="font-bold text-2xl text-gray-800">{result.total}</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Skipped (existing)</p>
                <p className="font-bold text-2xl text-gray-500">{result.skipped}</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${result.balanced ? 'bg-income-light' : 'bg-warning-light'}`}>
                <p className="text-gray-400 text-xs">Grand Total</p>
                <p className={`font-bold text-lg font-mono ${result.balanced ? 'text-income' : 'text-warning'}`}>
                  {result.grandTotal === 0 ? '0.00 ✓' : result.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            💡 <strong>Cash in Hand</strong> is marked as the Cash Account. The Trial Balance grand total should be zero.
          </p>
          <button className="btn-primary w-full justify-center" onClick={onClose}>Done</button>
        </div>
      ) : (
        // Pre-seed confirmation screen
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <p className="font-bold mb-2">📊 This will seed 145 accounts from the Excel file:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Opening balances loaded from the Trial Balance</li>
              <li><strong>Cash in Hand</strong> will be marked as the primary Cash Account</li>
              <li>Accounts already existing (by title) will be <strong>skipped</strong></li>
              <li>Grand total of all balances = 0 (accounting identity)</li>
            </ul>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ If you already have accounts, this will only add missing ones — no existing data will be overwritten.
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary flex-1 justify-center" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="btn-primary flex-1 justify-center" onClick={onConfirm} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Seeding...
                </span>
              ) : '🌱 Seed 145 Accounts'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [hasCashAccount, setHasCashAccount] = useState(false);
  const [cashAccountName, setCashAccountName] = useState('');
  const [search, setSearch]         = useState('');
  const [filterSub, setFilterSub]   = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]         = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]     = useState(false);

  // Seed modal state
  const [seedOpen, setSeedOpen]     = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data.accounts);

      // Check cash account status
      const cashRes = await api.get('/accounts/cash-status');
      setHasCashAccount(cashRes.data.hasCashAccount);
      setCashAccountName(cashRes.data.cashAccount?.accountTitle || '');
    } catch { toast.error('Failed to load accounts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Seed handler
  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const { data } = await api.post('/accounts/seed');
      setSeedResult(data);
      await load(); // refresh list
    } catch (err) {
      toast.error(err.message || 'Seed failed');
      setSeedOpen(false);
    } finally { setSeedLoading(false); }
  };

  const closeSeedModal = () => { setSeedOpen(false); setSeedResult(null); };

  // ── Form helpers
  const openCreate = () => { setEditAccount(null); setForm(EMPTY_FORM); setFormErrors({}); setModalOpen(true); };
  const openEdit   = (acc) => {
    setEditAccount(acc);
    setForm({
      accountTitle: acc.accountTitle, accountNo: acc.accountNo || '',
      accountType: acc.accountType, subAccount: acc.subAccount,
      financialStatement: acc.financialStatement, isCashAccount: acc.isCashAccount || false,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const setF = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'accountType') {
        next.subAccount         = TYPE_TO_SUB[v] || '';
        next.financialStatement = SUB_TO_FS[TYPE_TO_SUB[v]] || '';
      }
      return next;
    });
    setFormErrors(e => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.accountTitle.trim()) e.accountTitle = 'Account title is required';
    if (!form.accountType)         e.accountType  = 'Account type is required';
    if (!form.subAccount)          e.subAccount   = 'Sub-account is required';
    setFormErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editAccount) {
        await api.put(`/accounts/${editAccount._id}`, form);
        toast.success('Account updated');
      } else {
        await api.post('/accounts', form);
        toast.success('Account created');
      }
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/accounts/${deleteTarget._id}`);
      toast.success('Account deactivated');
      setDeleteTarget(null);
      load();
    } catch (err) { toast.error(err.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  // ── Display
  const filtered = accounts.filter(a =>
    (!search || a.accountTitle.toLowerCase().includes(search.toLowerCase()) || a.accountNo?.includes(search)) &&
    (!filterSub || a.subAccount === filterSub)
  );
  const grouped = filtered.reduce((g, a) => {
    const k = a.subAccount || 'Other';
    if (!g[k]) g[k] = [];
    g[k].push(a);
    return g;
  }, {});

  const grandTotal = accounts.reduce((s, a) => s + (a.currentBalance || 0), 0);
  const isBalanced = Math.abs(grandTotal) < 1;

  // Determine if the cash checkbox should be locked for the form
  const cashCheckboxDisabled = hasCashAccount && !editAccount?.isCashAccount;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-gray-400 text-sm flex items-center gap-2 flex-wrap">
            <span>{accounts.length} accounts</span>
            <span>·</span>
            <span className={`font-mono font-semibold ${isBalanced ? 'text-income' : 'text-expense'}`}>
              Grand Total: {formatCurrency(Math.abs(grandTotal))}
            </span>
            {isBalanced && <span className="badge bg-income-light text-income">✓ Balanced</span>}
            {hasCashAccount && (
              <>
                <span>·</span>
                <span className="badge bg-green-100 text-green-700">💵 Cash: {cashAccountName}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {/* Seed button — prominent when empty, subtle when accounts exist */}
          {/* {accounts.length === 0 ? (
            <button
              onClick={() => { setSeedResult(null); setSeedOpen(true); }}
              className="btn-primary flex items-center gap-2 animate-pulse"
            >
              🌱 Seed from Excel
            </button>
          ) : (
            <button
              onClick={() => { setSeedResult(null); setSeedOpen(true); }}
              className="btn btn-secondary flex items-center gap-2"
              title="Import Chart of Accounts from Excel (145 accounts with opening balances)"
            >
              🌱 Seed from Excel
            </button>
          )} */}
          <button onClick={openCreate} className="btn-primary">+ Add Account</button>
        </div>
      </div>

      {/* Empty state prompt */}
      {accounts.length === 0 && (
        <div className="card p-8 text-center border-2 border-dashed border-primary-200 bg-primary-50/30">
          <div className="text-5xl mb-3">📊</div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">No accounts yet</h3>
          <p className="text-gray-500 text-sm mb-5">
            Get started instantly by seeding the Chart of Accounts from the Excel file —
            145 accounts with opening balances, all balanced to zero.
          </p>
          <button
            onClick={() => { setSeedResult(null); setSeedOpen(true); }}
            className="btn-primary mx-auto"
          >
            🌱 Seed Chart of Accounts from Excel
          </button>
        </div>
      )}

      {/* Filters */}
      {accounts.length > 0 && (
        <div className="card p-4 flex flex-wrap gap-3">
          <input className="input w-64" placeholder="Search accounts..." value={search}
            onChange={e => setSearch(e.target.value)} />
          <select className="input w-48" value={filterSub} onChange={e => setFilterSub(e.target.value)}>
            <option value="">All Categories</option>
            {SUB_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || filterSub) && (
            <button onClick={() => { setSearch(''); setFilterSub(''); }} className="btn btn-secondary btn-sm">Clear</button>
          )}
        </div>
      )}

      {/* Account groups */}
      {accounts.length > 0 && filtered.length === 0 && (
        <EmptyState icon="🔍" title="No accounts match your search" />
      )}

      {SUB_ORDER.filter(s => grouped[s]?.length).map(sub => {
        const isAssetOrExp = ['Current Assets', 'Investments', 'Fixed Assets', 'Expenses'].includes(sub);
        const subTotal = grouped[sub].reduce((s, a) => s + a.currentBalance, 0);
        const displayTotal = isAssetOrExp ? subTotal : -subTotal;

        return (
          <div key={sub} className="card overflow-hidden">
            <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
              <h3 className={`text-sm font-bold uppercase tracking-wide ${subAccountColor(sub)}`}>{sub}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{grouped[sub].length} accounts</span>
                <span className={`font-mono text-xs font-bold ${subAccountColor(sub)}`}>
                  {formatCurrency(displayTotal)}
                </span>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Account Title</th>
                  <th className="table-th hidden md:table-cell">Account No.</th>
                  <th className="table-th hidden lg:table-cell">Type</th>
                  <th className="table-th text-right">Dr Balance</th>
                  <th className="table-th text-right">Cr Balance</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grouped[sub].map(acc => {
                  const bal = acc.currentBalance;
                  // Asset/Expense: normal = positive; abnormal = negative → show (amount)
                  // Liability/Equity/Revenue: normal = negative; abnormal = positive → show (amount)
                  const isDrNormal = ['Current Assets','Investments','Fixed Assets','Expenses'].includes(acc.subAccount);
                  const drAbnormal = isDrNormal && bal < 0;   // asset with negative balance
                  const crAbnormal = !isDrNormal && bal > 0;  // liability with positive balance
                  return (
                    <tr key={acc._id} className={`hover:bg-surface-50 transition-colors border-b border-surface-50 ${(drAbnormal || crAbnormal) ? 'bg-red-50/30' : ''}`}>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{acc.accountTitle}</span>
                          {acc.isCashAccount && (
                            <span className="badge bg-green-100 text-green-700 text-xs">💵 Cash</span>
                          )}
                          {(drAbnormal || crAbnormal) && (
                            <span className="badge bg-expense-light text-expense text-xs">⚠ Abnormal</span>
                          )}
                        </div>
                      </td>
                      <td className="table-td hidden md:table-cell text-xs text-gray-400 font-mono">
                        {acc.accountNo || '—'}
                      </td>
                      <td className="table-td hidden lg:table-cell text-xs text-gray-500">
                        {acc.accountType}
                      </td>
                      {/* Dr balance column */}
                      <td className="table-td text-right font-mono text-sm">
                        {bal > 0
                          ? <span className="font-semibold text-primary-700">{formatCurrency(bal)}</span>
                          : drAbnormal
                            ? <span className="font-semibold text-expense">({formatCurrency(-bal)})</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Cr balance column */}
                      <td className="table-td text-right font-mono text-sm">
                        {bal < 0
                          ? <span className="font-semibold text-income">{formatCurrency(-bal)}</span>
                          : crAbnormal
                            ? <span className="font-semibold text-expense">({formatCurrency(bal)})</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-td">
                        <div className="flex gap-3">
                          <Link to={`/accounts/${acc._id}/ledger`}
                            className="text-xs text-primary-600 hover:underline font-medium">Ledger</Link>
                          <button onClick={() => openEdit(acc)}
                            className="text-xs text-gray-500 hover:text-gray-800 font-medium">Edit</button>
                          {!acc.isSystemAccount && (
                            <button onClick={() => setDeleteTarget(acc)}
                              className="text-xs text-red-400 hover:text-red-600 font-medium">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* ── Create / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editAccount ? `Edit: ${editAccount.accountTitle}` : 'New Account'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Account Title *</label>
            <input
              className={`input ${formErrors.accountTitle ? 'input-error' : ''}`}
              placeholder="e.g. Cash in Hand"
              value={form.accountTitle}
              onChange={e => setF('accountTitle', e.target.value)}
              disabled={!!editAccount}
            />
            {editAccount && <p className="text-xs text-gray-400 mt-1">Account title cannot be changed after creation</p>}
            {formErrors.accountTitle && <p className="text-red-500 text-xs mt-1">{formErrors.accountTitle}</p>}
          </div>

          <div>
            <label className="label">Account No. / ID</label>
            <input className="input" placeholder="Optional" value={form.accountNo}
              onChange={e => setF('accountNo', e.target.value)} />
          </div>

          <div>
            <label className="label">Account Type *</label>
            <select className={`input ${formErrors.accountType ? 'input-error' : ''}`}
              value={form.accountType} onChange={e => setF('accountType', e.target.value)}>
              <option value="">Select type...</option>
              {ACCOUNT_TYPES_GROUPED.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.types.map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
            {formErrors.accountType && <p className="text-red-500 text-xs mt-1">{formErrors.accountType}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sub-Account (auto)</label>
              <input className="input bg-gray-50 text-gray-500" value={form.subAccount} readOnly placeholder="Auto-filled" />
            </div>
            <div>
              <label className="label">Financial Statement (auto)</label>
              <input className="input bg-gray-50 text-gray-500" value={form.financialStatement} readOnly placeholder="Auto-filled" />
            </div>
          </div>

          {/* Cash Account checkbox — conditionally locked */}
          {cashCheckboxDisabled ? (
            <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-60 cursor-not-allowed">
              <input type="checkbox" disabled checked={false} className="w-4 h-4 mt-0.5 accent-primary-600" />
              <div>
                <p className="text-sm font-medium text-gray-500">Mark as Cash Account</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  <strong>"{cashAccountName}"</strong> is already set as the Cash Account.
                  Edit that account to unmark it first.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${form.isCashAccount
                  ? 'bg-green-50 border-green-300'
                  : 'bg-surface-50 border-gray-200 hover:border-gray-300'}`}
              onClick={() => setF('isCashAccount', !form.isCashAccount)}
            >
              <input
                type="checkbox"
                id="isCash"
                checked={form.isCashAccount}
                onChange={e => setF('isCashAccount', e.target.checked)}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 mt-0.5 accent-green-600"
              />
              <label htmlFor="isCash" className="cursor-pointer">
                <p className="text-sm font-medium text-gray-700">
                  💵 Mark as Cash Account
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Auto-used as the Cash side in Cash Receive &amp; Cash Payment transactions
                </p>
              </label>
            </div>
          )}

          {!editAccount && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              💡 New accounts start with a zero balance. To set an opening balance,
              use a <strong>Multiple Fund Transfer</strong> transaction (Dr asset account, Cr Opening Capital).
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn btn-secondary flex-1 justify-center" disabled={saving}>
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'Saving...' : editAccount ? 'Update Account' : 'Create Account'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Seed Modal ── */}
      <SeedModal
        open={seedOpen}
        onClose={closeSeedModal}
        onConfirm={handleSeed}
        loading={seedLoading}
        result={seedResult}
      />

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate Account"
        message={`Deactivate "${deleteTarget?.accountTitle}"? Accounts with a non-zero balance cannot be deleted.`}
        confirmLabel="Deactivate"
        loading={deleting}
      />
    </div>
  );
}
