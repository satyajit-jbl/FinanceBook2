import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import api from '../utils/api';
import { today, formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import AccountSearchSelect from '../components/ui/AccountSearchSelect';

const TABS = [
  { key: 'cash_receive',           label: '💰 Cash Receive'    },
  { key: 'cash_payment',           label: '💸 Cash Payment'    },
  { key: 'fund_transfer',          label: '🔄 Fund Transfer'   },
  { key: 'multiple_fund_transfer', label: '⚡ Multiple Transfer'},
];

const CASH_RECEIVE_TYPES = [
  'Employment Income','Business Income','Freelancing / Hobby Trading Income',
  'Investment & Other Income','Other Income','Accounts Receivable (Lending)',
  'Savings Bank Account','DPS Account','Fixed Deposit Account','Savings Certificate',
];

const toDateInput = (d) => new Date(d).toISOString().split('T')[0];

function txnToForm(txn, cashAccountId) {
  const cashId = cashAccountId?.toString();
  const isCash = (id) => id?.toString() === cashId;
  const base = {
    date: toDateInput(txn.date),
    description: txn.description,
    reference: txn.reference || '',
    accountId: '', amount: '', debitAccountId: '', creditAccountId: '',
  };

  switch (txn.transactionType) {
    case 'cash_receive': {
      const line = txn.journalEntries.find(e => !isCash(e.accountId));
      return { ...base, accountId: line?.accountId || '', amount: String(txn.amount || '') };
    }
    case 'cash_payment': {
      const line = txn.journalEntries.find(e => !isCash(e.accountId));
      return { ...base, accountId: line?.accountId || '', amount: String(txn.amount || '') };
    }
    case 'fund_transfer': {
      const dr = txn.journalEntries.find(e => e.debit > 0);
      const cr = txn.journalEntries.find(e => e.credit > 0);
      return {
        ...base,
        debitAccountId: dr?.accountId || '',
        creditAccountId: cr?.accountId || '',
        amount: String(txn.amount || ''),
      };
    }
    case 'multiple_fund_transfer':
      return base;
    default:
      return base;
  }
}

function txnToEntries(txn) {
  return txn.journalEntries.map(e => ({
    accountId: e.accountId,
    debit:  e.debit  > 0 ? String(e.debit)  : '',
    credit: e.credit > 0 ? String(e.credit) : '',
  }));
}

// ── Insufficient balance modal ─────────────────────────────────────
function InsufficientBalanceModal({ open, warnings, onCancel, onForce, loading }) {
  return (
    <Modal open={open} onClose={onCancel} title="⚠️ Insufficient Balance Warning" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <p className="font-bold mb-2">This transaction will cause unusual balances:</p>
          <ul className="space-y-1">
            {warnings.map((w, i) => <li key={i} className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span><span>{w}</span></li>)}
          </ul>
        </div>
        <p className="text-xs text-gray-500">Proceeding may indicate a data entry error.</p>
        <div className="flex gap-3">
          <button className="btn btn-secondary flex-1 justify-center" onClick={onCancel} disabled={loading}>Cancel Transaction</button>
          <button className="btn btn-danger flex-1 justify-center" onClick={onForce} disabled={loading}>
            {loading ? 'Processing…' : 'Force Transaction'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Save template modal ────────────────────────────────────────────
function SaveTemplateModal({ open, onClose, onSave, loading }) {
  const [name, setName] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="💾 Save as Template" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Give this journal entry a name so you can reuse it next time.</p>
        <div>
          <label className="label">Template Name *</label>
          <input className="input" placeholder="e.g. Monthly Salary Distribution"
            value={name} onChange={e => setName(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())} />
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center" onClick={() => onSave(name.trim())} disabled={!name.trim() || loading}>
            {loading ? 'Saving…' : '💾 Save Template'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Load template modal ────────────────────────────────────────────
function LoadTemplateModal({ open, onClose, templates, onLoad, onDelete }) {
  return (
    <Modal open={open} onClose={onClose} title="📂 Saved Templates" size="md">
      {templates.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">📂</p>
          <p className="text-gray-500 text-sm">No saved templates yet.</p>
          <p className="text-gray-400 text-xs mt-1">After a Multiple Transfer, click "Save as Template" to save it.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t._id} className="flex items-start justify-between p-3 border border-surface-200 rounded-xl hover:bg-surface-50 transition-colors">
              <div className="flex-1 min-w-0 mr-3">
                <p className="font-semibold text-sm text-gray-800">{t.name}</p>
                {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {t.entries.length} lines · Used {t.usageCount}×
                  {t.lastUsed && ` · Last: ${new Date(t.lastUsed).toLocaleDateString()}`}
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {t.entries.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-gray-500">
                      {e.debit > 0 ? '↑ Dr' : '↓ Cr'} {e.accountTitle} — {formatCurrency(e.debit || e.credit)}
                    </p>
                  ))}
                  {t.entries.length > 3 && <p className="text-xs text-gray-400">+ {t.entries.length - 3} more…</p>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => onLoad(t)} className="btn-primary btn-sm">Load</button>
                <button onClick={() => onDelete(t._id)} className="btn btn-secondary btn-sm text-red-500">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function NewTransactionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [searchParams] = useSearchParams();
  const [tab,        setTab]        = useState(searchParams.get('type') || 'cash_receive');
  const [accounts,   setAccounts]   = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors,     setErrors]     = useState({});
  const [originalJournal, setOriginalJournal] = useState(null);
  const [editReason, setEditReason] = useState('');

  const [form, setForm] = useState({
    date: today(), accountId: '', amount: '', description: '', reference: '',
    debitAccountId: '', creditAccountId: '',
  });
  const [entries, setEntries] = useState([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' },
  ]);

  // Modal state
  const [warnOpen,    setWarnOpen]    = useState(false);
  const [warnMsgs,    setWarnMsgs]    = useState([]);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [saveOpen,    setSaveOpen]    = useState(false);
  const [loadOpen,    setLoadOpen]    = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  // After transaction: offer to update template
  const [lastTemplateId, setLastTemplateId] = useState(null);
  const [resaveOpen, setResaveOpen]  = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const requests = [api.get('/accounts')];
        if (isEditMode) requests.push(api.get(`/transactions/${id}`));
        else requests.push(api.get('/templates'));

        const [aRes, secondRes] = await Promise.all(requests);
        const accts = aRes.data.accounts;
        setAccounts(accts);

        if (isEditMode) {
          const txn = secondRes.data.transaction;
          if (txn.status === 'void') {
            toast.error('Voided transactions cannot be edited');
            navigate('/transactions');
            return;
          }
          const cashAcc = accts.find(a => a.isCashAccount);
          setTab(txn.transactionType);
          setForm(txnToForm(txn, cashAcc?._id));
          if (txn.transactionType === 'multiple_fund_transfer') {
            setEntries(txnToEntries(txn));
          }
          setOriginalJournal(txn.journalEntries.map(e => ({
            accountId: e.accountId,
            debit: e.debit,
            credit: e.credit,
          })));
        } else {
          setTemplates(secondRes.data.templates);
        }
      } catch {
        toast.error(isEditMode ? 'Failed to load transaction' : 'Failed to load data');
        if (isEditMode) navigate('/transactions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEditMode, navigate]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const accountsMap = accounts.reduce((m, a) => { m[a._id] = a; return m; }, {});

  // ── Template operations ─────────────────────────────────────────
  const handleLoadTemplate = (tpl) => {
    // Fill entries from template, preserving editable state
    setEntries(tpl.entries.map(e => ({
      accountId: e.accountId,
      debit:  e.debit  > 0 ? e.debit.toString()  : '',
      credit: e.credit > 0 ? e.credit.toString() : '',
    })));
    setLastTemplateId(tpl._id);
    setLoadOpen(false);
    // Record usage
    api.post(`/templates/${tpl._id}/use`).catch(() => {});
    toast.success(`Template "${tpl.name}" loaded — edit as needed`);
  };

  const handleSaveTemplate = async (name) => {
    const valid = entries.filter(e => e.accountId && (parseFloat(e.debit) > 0 || parseFloat(e.credit) > 0));
    if (valid.length < 2) { toast.error('Add at least 2 lines first'); return; }
    setSaveLoading(true);
    try {
      const { data } = await api.post('/templates', {
        name,
        entries: valid.map(e => ({
          accountId: e.accountId,
          accountTitle: accountsMap[e.accountId]?.accountTitle || '',
          debit:  parseFloat(e.debit)  || 0,
          credit: parseFloat(e.credit) || 0,
        })),
      });
      setTemplates(t => [data.template, ...t]);
      setLastTemplateId(data.template._id);
      setSaveOpen(false);
      toast.success(`Template "${name}" saved!`);
    } catch (err) { toast.error(err.message || 'Save failed'); }
    finally { setSaveLoading(false); }
  };

  const handleResaveTemplate = async () => {
    if (!lastTemplateId) return;
    const valid = entries.filter(e => e.accountId && (parseFloat(e.debit) > 0 || parseFloat(e.credit) > 0));
    try {
      await api.put(`/templates/${lastTemplateId}`, {
        entries: valid.map(e => ({
          accountId: e.accountId,
          accountTitle: accountsMap[e.accountId]?.accountTitle || '',
          debit:  parseFloat(e.debit)  || 0,
          credit: parseFloat(e.credit) || 0,
        })),
      });
      toast.success('Template updated!');
    } catch (err) { toast.error(err.message || 'Update failed'); }
    setResaveOpen(false);
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(t => t.filter(x => x._id !== id));
      toast.success('Template deleted');
    } catch { toast.error('Delete failed'); }
  };

  // ── Validation ──────────────────────────────────────────────────
  const validateSimple = () => {
    const e = {};
    if (!form.date) e.date = 'Date required';
    if (!form.accountId) e.accountId = 'Account required';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.description.trim()) e.description = 'Description required';
    setErrors(e); return !Object.keys(e).length;
  };
  const validateTransfer = () => {
    const e = {};
    if (!form.date) e.date = 'Date required';
    if (!form.debitAccountId) e.debitAccountId = 'Debit account required';
    if (!form.creditAccountId) e.creditAccountId = 'Credit account required';
    if (form.debitAccountId === form.creditAccountId) e.debitAccountId = 'Must be different accounts';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.description.trim()) e.description = 'Description required';
    setErrors(e); return !Object.keys(e).length;
  };
  const validateMultiple = () => {
    const e = {};
    if (!form.date) e.date = 'Date required';
    if (!form.description.trim()) e.description = 'Description required';
    const valid = entries.filter(en => en.accountId && (parseFloat(en.debit) > 0 || parseFloat(en.credit) > 0));
    if (valid.length < 2) { e.entries = 'At least 2 lines with amounts required'; }
    else {
      const tDr = valid.reduce((s, en) => s + (parseFloat(en.debit) || 0), 0);
      const tCr = valid.reduce((s, en) => s + (parseFloat(en.credit) || 0), 0);
      if (Math.abs(tDr - tCr) > 0.01) e.entries = `Debit (${formatCurrency(tDr)}) ≠ Credit (${formatCurrency(tCr)})`;
    }
    setErrors(e); return !Object.keys(e).length;
  };

  // ── Balance check ────────────────────────────────────────────────
  const buildJournalLines = () => {
    const cashAcc = accounts.find(a => a.isCashAccount);
    const amt = parseFloat(form.amount) || 0;
    if (tab === 'cash_receive') return [{ accountId: cashAcc?._id, debit: amt, credit: 0 }, { accountId: form.accountId, debit: 0, credit: amt }];
    if (tab === 'cash_payment') return [{ accountId: form.accountId, debit: amt, credit: 0 }, { accountId: cashAcc?._id, debit: 0, credit: amt }];
    if (tab === 'fund_transfer') return [{ accountId: form.debitAccountId, debit: amt, credit: 0 }, { accountId: form.creditAccountId, debit: 0, credit: amt }];
    return entries.filter(e => e.accountId && (parseFloat(e.debit) > 0 || parseFloat(e.credit) > 0))
      .map(e => ({ accountId: e.accountId, debit: parseFloat(e.debit)||0, credit: parseFloat(e.credit)||0 }));
  };

  const checkBalanceWarnings = (lines) => {
    const warnings = [];
    const lineKey = (l) => l.accountId?.toString();
    const accountIds = new Set(lines.map(lineKey));
    if (originalJournal) originalJournal.forEach(l => accountIds.add(lineKey(l)));

    for (const accountId of accountIds) {
      const acc = accountsMap[accountId] || accounts.find(a => a._id?.toString() === accountId);
      if (!acc) continue;

      const sumNet = (entries) => entries
        .filter(l => lineKey(l) === accountId)
        .reduce((s, l) => s + ((parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0)), 0);

      const oldNet = originalJournal ? sumNet(originalJournal) : 0;
      const newNet = sumNet(lines);
      const newBal = acc.currentBalance + (newNet - oldNet);

      const isAsset = ['Current Assets','Investments','Fixed Assets'].includes(acc.subAccount);
      const isLiabEq = ['Current Liabilities','Short-term Liabilities','Long-term Liabilities','Equity','Revenue'].includes(acc.subAccount);
      if (isAsset  && newBal < 0) warnings.push(`"${acc.accountTitle}" (${acc.subAccount}) will become (${formatCurrency(-newBal)}) — assets should not be negative.`);
      if (isLiabEq && newBal > 0) warnings.push(`"${acc.accountTitle}" (${acc.subAccount}) will become ${formatCurrency(newBal)} (positive) — liabilities/equity should not be positive.`);
    }
    return warnings;
  };

  // ── Submit ───────────────────────────────────────────────────────
  const buildBody = () => {
    const amt = parseFloat(form.amount);
    if (tab === 'cash_receive' || tab === 'cash_payment') {
      return { date: form.date, accountId: form.accountId, amount: amt, description: form.description, reference: form.reference };
    }
    if (tab === 'fund_transfer') {
      return { date: form.date, debitAccountId: form.debitAccountId, creditAccountId: form.creditAccountId, amount: amt, description: form.description, reference: form.reference };
    }
    const validE = entries.filter(e => e.accountId && (parseFloat(e.debit) > 0 || parseFloat(e.credit) > 0));
    return {
      date: form.date, description: form.description, reference: form.reference,
      entries: validE.map(e => ({ accountId: e.accountId, debit: parseFloat(e.debit) || 0, credit: parseFloat(e.credit) || 0 })),
    };
  };

  const submit = async (force = false) => {
    let valid = false;
    if (tab === 'cash_receive' || tab === 'cash_payment') valid = validateSimple();
    else if (tab === 'fund_transfer') valid = validateTransfer();
    else valid = validateMultiple();
    if (!valid) return;

    if (isEditMode && !editReason.trim()) {
      setErrors({ editReason: 'Edit reason is required (audit trail)' });
      toast.error('Please enter a reason for this edit');
      return;
    }

    const body = buildBody();
    if (isEditMode) body.editReason = editReason.trim();

    let endpoint;
    if (!isEditMode) {
      if (tab === 'cash_receive') endpoint = '/transactions/cash-receive';
      else if (tab === 'cash_payment') endpoint = '/transactions/cash-payment';
      else if (tab === 'fund_transfer') endpoint = '/transactions/fund-transfer';
      else endpoint = '/transactions/multiple-fund-transfer';
    }

    if (!force) {
      const warnings = checkBalanceWarnings(buildJournalLines());
      if (warnings.length > 0) {
        setWarnMsgs(warnings);
        setPendingPayload(isEditMode ? { mode: 'edit', body } : { mode: 'create', endpoint, body });
        setWarnOpen(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEditMode) {
        await api.put(`/transactions/${id}`, body);
        toast.success('Transaction updated!');
        navigate('/transactions');
      } else {
        await api.post(endpoint, body);
        toast.success('Transaction recorded!');
        if (tab === 'multiple_fund_transfer') {
          if (lastTemplateId) setResaveOpen(true);
          else setSaveOpen(true);
        } else {
          navigate('/transactions');
        }
      }
    } catch (err) { toast.error(err.message || (isEditMode ? 'Update failed' : 'Transaction failed')); }
    finally { setSubmitting(false); }
  };

  const handleForceTransaction = async () => {
    if (!pendingPayload) return;
    setSubmitting(true);
    try {
      if (pendingPayload.mode === 'edit') {
        await api.put(`/transactions/${id}`, pendingPayload.body);
        toast.success('Transaction updated (forced).');
        setWarnOpen(false);
        navigate('/transactions');
      } else {
        await api.post(pendingPayload.endpoint, pendingPayload.body);
        toast.success('Transaction recorded (forced).');
        setWarnOpen(false);
        if (tab === 'multiple_fund_transfer') setSaveOpen(true);
        else navigate('/transactions');
      }
    } catch (err) { toast.error(err.message || 'Transaction failed'); }
    finally { setSubmitting(false); }
  };

  // Multiple entry helpers
  const updateEntry = (i, field, val) => setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  const addEntry    = () => setEntries(e => [...e, { accountId: '', debit: '', credit: '' }]);
  const removeEntry = (i) => setEntries(e => e.filter((_, idx) => idx !== i));
  const totalDr = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
  const totalCr = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const cashReceiveFilter = (a) => CASH_RECEIVE_TYPES.includes(a.accountType) || a.subAccount === 'Revenue'|| a.subAccount === 'Current Liabilities';
  const cashPaymentFilter = (a) => a.subAccount === 'Expenses' || a.subAccount === 'Current Liabilities' || a.subAccount === 'Current Assets'||
  a.subAccount === 'Short-term Liabilities' ||
  a.subAccount === 'Long-term Liabilities' || a.subAccount === 'Investments'|| a.subAccount === 'Fixed Assets';

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Transaction' : 'New Transaction'}
          </h1>
          <p className="text-gray-400 text-xs md:text-sm">
            {isEditMode ? 'Modify posted entry — original journal is reversed and re-posted' : 'Double-entry journal entry'}
          </p>
        </div>
        <button onClick={() => navigate('/transactions')} className="btn btn-secondary btn-sm">← Back</button>
      </div>

      {/* Type tabs — locked in edit mode (bank software does not allow type change) */}
      <div className={`card p-1 grid grid-cols-2 md:grid-cols-4 gap-1 ${isEditMode ? 'opacity-80 pointer-events-none' : ''}`}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { if (!isEditMode) { setTab(t.key); setErrors({}); } }}
            className={`py-2.5 px-2 rounded-lg text-xs font-semibold transition-all
              ${tab === t.key ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {isEditMode && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Transaction type cannot be changed after posting. Edit date, accounts, amounts, and description only.
        </p>
      )}

      {/* Form */}
      <div className="card p-4 md:p-5 space-y-4">
        {/* Date + Reference */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date *</label>
            <input type="date" className={`input ${errors.date ? 'input-error' : ''}`}
              value={form.date} onChange={e => set('date', e.target.value)} />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>
          <div>
            <label className="label">Reference No.</label>
            <input type="text" className="input" placeholder="Optional" value={form.reference} onChange={e => set('reference', e.target.value)} />
          </div>
        </div>

        {/* Cash Receive */}
        {tab === 'cash_receive' && (
          <div>
            <div className="mb-2 p-2.5 bg-income-light rounded-lg text-xs text-income font-medium">
              💰 Dr: Cash (Auto) → Cr: Selected Account
            </div>
            <label className="label">Income / Source Account *</label>
            <AccountSearchSelect accounts={accounts} filter={cashReceiveFilter} value={form.accountId}
              onChange={(id) => set('accountId', id)} placeholder="Search income or receivable…" error={!!errors.accountId} />
            {errors.accountId && <p className="text-red-500 text-xs mt-1">{errors.accountId}</p>}
          </div>
        )}

        {/* Cash Payment */}
        {tab === 'cash_payment' && (
          <div>
            <div className="mb-2 p-2.5 bg-expense-light rounded-lg text-xs text-expense font-medium">
              💸 Dr: Selected Account → Cr: Cash (Auto)
            </div>
            <label className="label">Expense / Payment / Deposit Account *</label>
            <AccountSearchSelect accounts={accounts} filter={cashPaymentFilter} value={form.accountId}
              onChange={(id) => set('accountId', id)} placeholder="Search expense or payable…" error={!!errors.accountId} />
            {errors.accountId && <p className="text-red-500 text-xs mt-1">{errors.accountId}</p>}
          </div>
        )}

        {/* Fund Transfer */}
        {tab === 'fund_transfer' && (
          <div className="space-y-3">
            <div>
              <label className="label">Debit Account (Dr) *</label>
              <AccountSearchSelect accounts={accounts} value={form.debitAccountId}
                onChange={(id) => set('debitAccountId', id)} placeholder="Search debit account…" error={!!errors.debitAccountId} />
              {errors.debitAccountId && <p className="text-red-500 text-xs mt-1">{errors.debitAccountId}</p>}
            </div>
            <div>
              <label className="label">Credit Account (Cr) *</label>
              <AccountSearchSelect accounts={accounts} value={form.creditAccountId}
                onChange={(id) => set('creditAccountId', id)} placeholder="Search credit account…" error={!!errors.creditAccountId} />
              {errors.creditAccountId && <p className="text-red-500 text-xs mt-1">{errors.creditAccountId}</p>}
            </div>
          </div>
        )}

        {/* Amount for simple types */}
        {tab !== 'multiple_fund_transfer' && (
          <div>
            <label className="label">Amount (৳) *</label>
            <input type="number" className={`input font-mono ${errors.amount ? 'input-error' : ''}`}
              placeholder="0.00" min="0.01" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="label">Description *</label>
          <input type="text" className={`input ${errors.description ? 'input-error' : ''}`}
            placeholder="Transaction description" value={form.description} onChange={e => set('description', e.target.value)} maxLength={500} />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
        </div>

        {isEditMode && (
          <div>
            <label className="label">Reason for Edit *</label>
            <textarea className={`input resize-none ${errors.editReason ? 'input-error' : ''}`} rows={2}
              placeholder="e.g. Corrected amount, wrong account selected…"
              value={editReason} onChange={e => { setEditReason(e.target.value); setErrors(er => ({ ...er, editReason: '' })); }} />
            {errors.editReason && <p className="text-red-500 text-xs mt-1">{errors.editReason}</p>}
            <p className="text-xs text-gray-400 mt-1">Required for audit trail (standard in accounting systems).</p>
          </div>
        )}
      </div>

      {/* Multiple Fund Transfer — journal entry grid */}
      {tab === 'multiple_fund_transfer' && (
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Journal Entry Lines</h3>
            <div className="flex items-center gap-2">
              <span className={`badge ${balanced ? 'bg-income-light text-income' : 'bg-red-50 text-red-600'}`}>
                {balanced ? '✓ Balanced' : `Dr:${formatCurrency(totalDr)} Cr:${formatCurrency(totalCr)}`}
              </span>
              {/* Template buttons — create mode only */}
              {!isEditMode && (
              <button onClick={() => setLoadOpen(true)} className="btn btn-secondary btn-sm" title="Load template">
                📂 <span className="hidden sm:inline">Templates</span>
              </button>
              )}
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              <div className="col-span-6">Account</div>
              <div className="col-span-3">Debit (Dr)</div>
              <div className="col-span-2">Credit (Cr)</div>
              <div className="col-span-1"></div>
            </div>
            {entries.map((entry, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6">
                  <AccountSearchSelect accounts={accounts} value={entry.accountId}
                    onChange={(id) => updateEntry(i, 'accountId', id)} placeholder="Account…" />
                </div>
                <div className="col-span-3">
                  <input type="number" className="input text-xs py-2 font-mono" placeholder="0.00"
                    min="0" step="0.01" value={entry.debit}
                    onChange={e => updateEntry(i, 'debit', e.target.value)}
                    onFocus={() => { if (entry.credit) updateEntry(i, 'credit', ''); }} />
                </div>
                <div className="col-span-2">
                  <input type="number" className="input text-xs py-2 font-mono" placeholder="0.00"
                    min="0" step="0.01" value={entry.credit}
                    onChange={e => updateEntry(i, 'credit', e.target.value)}
                    onFocus={() => { if (entry.debit) updateEntry(i, 'debit', ''); }} />
                </div>
                <div className="col-span-1 flex justify-center pt-2">
                  {entries.length > 2 && (
                    <button onClick={() => removeEntry(i)} className="text-red-400 hover:text-red-600 text-xl leading-none">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {errors.entries && <p className="text-red-500 text-xs mb-2 p-2 bg-red-50 rounded">{errors.entries}</p>}
          <button onClick={addEntry} className="btn btn-secondary btn-sm w-full justify-center">+ Add Line</button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Total Debit</p>
              <p className="font-mono font-bold text-primary-700">{formatCurrency(totalDr)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Total Credit</p>
              <p className="font-mono font-bold text-primary-700">{formatCurrency(totalCr)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={() => navigate('/transactions')} className="btn btn-secondary flex-1 justify-center" disabled={submitting}>Cancel</button>
        <button onClick={() => submit(false)} className="btn-primary flex-1 justify-center py-2.5 md:py-3" disabled={submitting}>
          {submitting ? (isEditMode ? 'Saving…' : 'Recording…') : (isEditMode ? '✓ Save Changes' : '✓ Record Transaction')}
        </button>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <InsufficientBalanceModal open={warnOpen} warnings={warnMsgs}
        onCancel={() => { setWarnOpen(false); setPendingPayload(null); }}
        onForce={handleForceTransaction} loading={submitting} />

      <SaveTemplateModal open={saveOpen}
        onClose={() => { setSaveOpen(false); navigate('/transactions'); }}
        onSave={async (name) => { await handleSaveTemplate(name); navigate('/transactions'); }}
        loading={saveLoading} />

      <LoadTemplateModal open={loadOpen} onClose={() => setLoadOpen(false)}
        templates={templates} onLoad={handleLoadTemplate} onDelete={handleDeleteTemplate} />

      {/* Re-save existing template offer */}
      <Modal open={resaveOpen} onClose={() => { setResaveOpen(false); navigate('/transactions'); }}
        title="Update Template?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Would you like to update the previously loaded template with the current entry data?</p>
          <div className="flex gap-3">
            <button className="btn btn-secondary flex-1 justify-center"
              onClick={() => { setResaveOpen(false); navigate('/transactions'); }}>No, Keep Original</button>
            <button className="btn-primary flex-1 justify-center"
              onClick={async () => { await handleResaveTemplate(); navigate('/transactions'); }}>
              ✓ Update Template
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
