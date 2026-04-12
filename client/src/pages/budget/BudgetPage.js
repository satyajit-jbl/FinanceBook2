import { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import AccountSearchSelect from '../../components/ui/AccountSearchSelect';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, Legend,
} from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

// ── Colour helpers ──────────────────────────────────────────────────
const pctColor = (pct, isExpense) => {
  if (isExpense) {
    if (pct > 110) return 'text-expense';
    if (pct > 90)  return 'text-yellow-600';
    return 'text-income';
  }
  if (pct >= 100) return 'text-income';
  if (pct >= 70)  return 'text-yellow-600';
  return 'text-expense';
};

const barColor = (pct, isExpense) => {
  if (isExpense) { return pct > 110 ? '#dc2626' : pct > 90 ? '#ca8a04' : '#16a34a'; }
  return pct >= 100 ? '#16a34a' : pct >= 70 ? '#ca8a04' : '#dc2626';
};

// ── Budget line row ────────────────────────────────────────────────
function BudgetLine({ line, isExpense, showActuals }) {
  const actual   = line.actual ?? 0;
  const budgeted = line.budgetedAmount;
  const pct      = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
  const variance = budgeted - actual;

  return (
    <div className="grid grid-cols-12 gap-2 py-2.5 border-b border-surface-50 items-center hover:bg-surface-50/50 px-1">
      <div className="col-span-4 text-sm text-gray-700 truncate">{line.accountTitle}</div>
      <div className="col-span-2 text-right font-mono text-sm text-primary-700 font-semibold">
        {formatCurrency(budgeted)}
      </div>
      {showActuals ? (
        <>
          <div className="col-span-2 text-right font-mono text-sm font-semibold">
            <span className={pctColor(pct, isExpense)}>{formatCurrency(actual)}</span>
          </div>
          <div className="col-span-2 text-right font-mono text-xs font-semibold">
            <span className={variance >= 0 ? 'text-income' : 'text-expense'}>
              {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
            </span>
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, pct)}%`, background: barColor(pct, isExpense) }} />
              </div>
              <span className={`text-xs font-mono w-8 text-right ${pctColor(pct, isExpense)}`}>{pct}%</span>
            </div>
          </div>
        </>
      ) : (
        <div className="col-span-6 text-xs text-gray-400 italic">{line.notes || '—'}</div>
      )}
    </div>
  );
}

// ── Section totals row ─────────────────────────────────────────────
function SectionTotal({ label, budgeted, actual, showActuals, color }) {
  const pct = budgeted > 0 ? Math.round((actual / budgeted) * 100) : 0;
  return (
    <div className={`grid grid-cols-12 gap-2 py-2.5 px-1 border-t-2 ${color} font-bold`}>
      <div className="col-span-4 text-sm">{label}</div>
      <div className="col-span-2 text-right font-mono text-sm">{formatCurrency(budgeted)}</div>
      {showActuals ? (
        <>
          <div className="col-span-2 text-right font-mono text-sm">{formatCurrency(actual)}</div>
          <div className="col-span-2 text-right font-mono text-xs">
            <span className={(budgeted - actual) >= 0 ? 'text-income' : 'text-expense'}>
              {(budgeted - actual) >= 0 ? '+' : ''}{formatCurrency(budgeted - actual)}
            </span>
          </div>
          <div className="col-span-2 text-right text-xs font-mono">{pct}%</div>
        </>
      ) : (
        <div className="col-span-6" />
      )}
    </div>
  );
}

// ── Budget form modal ──────────────────────────────────────────────
function BudgetFormModal({ open, onClose, onSaved, editBudget, accounts }) {
  const [step, setStep]   = useState(1); // 1=meta 2=income 3=expenses
  const [form, setForm]   = useState({
    name: '', period: 'monthly', year: CURRENT_YEAR, month: CURRENT_MONTH,
    incomeLines: [], expenseLines: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editBudget) {
      setForm({
        name:         editBudget.name,
        period:       editBudget.period,
        year:         editBudget.year,
        month:        editBudget.month || CURRENT_MONTH,
        incomeLines:  editBudget.incomeLines.map(l => ({ ...l, accountId: l.accountId })),
        expenseLines: editBudget.expenseLines.map(l => ({ ...l, accountId: l.accountId })),
      });
    } else {
      setForm({ name: '', period: 'monthly', year: CURRENT_YEAR, month: CURRENT_MONTH, incomeLines: [], expenseLines: [] });
    }
    setStep(1);
  }, [editBudget, open]);

  const incomeAccounts  = accounts.filter(a => a.subAccount === 'Revenue');
  const expenseAccounts = accounts.filter(a => ['Expenses','Current Liabilities','Short-term Liabilities','Long-term Liabilities','Current Assets'].includes(a.subAccount));

  const addLine = (type, acc) => {
    const key = type === 'income' ? 'incomeLines' : 'expenseLines';
    if (!acc) return;
    if (form[key].find(l => l.accountId === acc._id)) return; // already added
    setForm(f => ({
      ...f,
      [key]: [...f[key], {
        accountId: acc._id, accountTitle: acc.accountTitle,
        accountType: acc.accountType, subAccount: acc.subAccount,
        budgetedAmount: 0, notes: '',
      }],
    }));
  };

  const updateLine = (type, idx, field, val) => {
    const key = type === 'income' ? 'incomeLines' : 'expenseLines';
    setForm(f => {
      const lines = [...f[key]];
      lines[idx] = { ...lines[idx], [field]: val };
      return { ...f, [key]: lines };
    });
  };

  const removeLine = (type, idx) => {
    const key = type === 'income' ? 'incomeLines' : 'expenseLines';
    setForm(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Budget name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), period: form.period,
        year: parseInt(form.year), month: form.period === 'monthly' ? parseInt(form.month) : null,
        incomeLines:  form.incomeLines.map(l => ({ ...l, budgetedAmount: parseFloat(l.budgetedAmount) || 0 })),
        expenseLines: form.expenseLines.map(l => ({ ...l, budgetedAmount: parseFloat(l.budgetedAmount) || 0 })),
      };
      if (editBudget) {
        await api.put(`/budget/${editBudget._id}`, payload);
        toast.success('Budget updated');
      } else {
        await api.post('/budget', payload);
        toast.success('Budget created');
      }
      onSaved();
      onClose();
    } catch (err) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const LineEditor = ({ type, lines, available }) => {
    const [addId, setAddId] = useState('');
    return (
      <div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <AccountSearchSelect
              accounts={available.filter(a => !lines.find(l => l.accountId === a._id))}
              value={addId}
              onChange={(id, acc) => { addLine(type, acc); setAddId(''); }}
              placeholder={`Add ${type} account…`}
            />
          </div>
        </div>
        {lines.length === 0 && (
          <p className="text-xs text-gray-400 italic text-center py-3">No accounts added yet. Search above to add.</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-surface-50">
            <div className="col-span-5 text-sm text-gray-700 truncate">{line.accountTitle}</div>
            <div className="col-span-3">
              <input type="number" className="input py-1.5 text-xs font-mono" placeholder="৳ Amount"
                min="0" step="0.01" value={line.budgetedAmount}
                onChange={e => updateLine(type, i, 'budgetedAmount', e.target.value)} />
            </div>
            <div className="col-span-3">
              <input type="text" className="input py-1.5 text-xs" placeholder="Note (optional)"
                value={line.notes} onChange={e => updateLine(type, i, 'notes', e.target.value)} />
            </div>
            <div className="col-span-1 flex justify-center">
              <button onClick={() => removeLine(type, i)}
                className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
          </div>
        ))}
        {lines.length > 0 && (
          <div className="flex justify-between items-center pt-2 text-xs font-bold text-gray-600">
            <span>Total Budgeted</span>
            <span className="font-mono">{formatCurrency(lines.reduce((s, l) => s + (parseFloat(l.budgetedAmount) || 0), 0))}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={editBudget ? 'Edit Budget' : 'New Budget Plan'} size="xl">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-5">
        {['Period & Name','Income Plan','Expense Plan'].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button onClick={() => setStep(i+1)}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${step === i+1 ? 'bg-primary-600 text-white' : step > i+1 ? 'bg-income text-white' : 'bg-gray-100 text-gray-400'}`}>
              {step > i+1 ? '✓' : i+1}
            </button>
            <span className={`text-xs font-medium hidden sm:inline ${step === i+1 ? 'text-primary-700' : 'text-gray-400'}`}>{s}</span>
            {i < 2 && <div className="flex-1 h-px bg-gray-200 w-4" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Meta */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">Budget Name *</label>
            <input className="input" placeholder="e.g. April 2026 Budget"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Period</label>
              <select className="input" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <select className="input" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}>
                {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          {form.period === 'monthly' && (
            <div>
              <label className="label">Month</label>
              <select className="input" value={form.month} onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Income */}
      {step === 2 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">Add expected income sources and their budgeted amounts.</p>
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">
            <div className="col-span-5">Account</div>
            <div className="col-span-3">Budgeted (৳)</div>
            <div className="col-span-3">Note</div>
            <div className="col-span-1"></div>
          </div>
          <LineEditor type="income" lines={form.incomeLines} available={incomeAccounts} />
        </div>
      )}

      {/* Step 3 — Expenses */}
      {step === 3 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">Add expected expenses, loan EMIs, DPS, insurance, etc.</p>
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">
            <div className="col-span-5">Account</div>
            <div className="col-span-3">Budgeted (৳)</div>
            <div className="col-span-3">Note</div>
            <div className="col-span-1"></div>
          </div>
          <LineEditor type="expenses" lines={form.expenseLines} available={expenseAccounts} />
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="btn btn-secondary" disabled={saving}>Cancel</button>
        <div className="flex-1" />
        {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn btn-secondary">← Back</button>}
        {step < 3
          ? <button onClick={() => setStep(s => s + 1)} className="btn-primary">Next →</button>
          : <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editBudget ? '✓ Update Budget' : '✓ Create Budget'}
            </button>
        }
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN BUDGET PAGE
// ═══════════════════════════════════════════════════════════════════
export default function BudgetPage() {
  const [budgets,    setBudgets]    = useState([]);
  const [accounts,   setAccounts]   = useState([]);
  const [selected,   setSelected]   = useState(null); // full budget with actuals
  const [summary,    setSummary]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen,   setFormOpen]   = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [bRes, aRes] = await Promise.all([
        api.get('/budget'),
        api.get('/accounts'),
      ]);
      setBudgets(bRes.data.budgets);
      setAccounts(aRes.data.accounts);
      // Auto-select most recent
      if (bRes.data.budgets.length && !selected) {
        loadDetail(bRes.data.budgets[0]._id);
      }
    } catch { toast.error('Failed to load budgets'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/budget/${id}`);
      setSelected(data.budget);
      setSummary(data.summary);
    } catch { toast.error('Failed to load budget details'); }
    finally { setDetailLoading(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/budget/${deleteTarget._id}`);
      toast.success('Budget deleted');
      setDeleteTarget(null);
      if (selected?._id === deleteTarget._id) { setSelected(null); setSummary(null); }
      load();
    } catch (err) { toast.error(err.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const showActuals = !!selected;

  // ── Chart data ─────────────────────────────────────────────────
  const chartData = selected ? [
    ...selected.incomeLines.map(l => ({
      name: l.accountTitle.length > 14 ? l.accountTitle.slice(0, 14) + '…' : l.accountTitle,
      Budget: l.budgetedAmount, Actual: l.actual, type: 'income',
    })),
    ...selected.expenseLines.map(l => ({
      name: l.accountTitle.length > 14 ? l.accountTitle.slice(0, 14) + '…' : l.accountTitle,
      Budget: l.budgetedAmount, Actual: l.actual, type: 'expense',
    })),
  ].filter(d => d.Budget > 0 || d.Actual > 0) : [];

  // ── Suggestions ────────────────────────────────────────────────
  const suggestions = [];
  if (summary) {
    const netBudget = summary.totalBudgetIncome  - summary.totalBudgetExpense;
    const netActual = summary.totalActualIncome  - summary.totalActualExpense;
    const savingsRate = summary.totalActualIncome > 0
      ? ((netActual / summary.totalActualIncome) * 100).toFixed(1) : 0;

    if (netActual < 0) suggestions.push({ type:'danger', text:`⚠️ You're spending more than you earn this period! Deficit of ${formatCurrency(-netActual)}. Immediately reduce discretionary expenses.` });
    else if (savingsRate < 10) suggestions.push({ type:'warning', text:`💡 Savings rate is only ${savingsRate}%. Try to reach at least 10–20% by reducing your top expense category.` });
    else suggestions.push({ type:'good', text:`✅ Great! Savings rate of ${savingsRate}% this period. Keep it up and allocate surplus to investments.` });

    // Over-budget expenses
    (selected?.expenseLines || []).filter(l => l.pct > 100).forEach(l => {
      suggestions.push({ type:'warning', text:`⚠️ "${l.accountTitle}" is ${l.pct}% of budget — over by ${formatCurrency(l.actual - l.budgetedAmount)}. Review and reduce next period.` });
    });

    // Under-realized income
    (selected?.incomeLines || []).filter(l => l.pct < 80 && l.budgetedAmount > 0).forEach(l => {
      suggestions.push({ type:'warning', text:`📉 "${l.accountTitle}" income is only ${l.pct}% realized (${formatCurrency(l.actual)} of ${formatCurrency(l.budgetedAmount)} budgeted). Follow up on this income source.` });
    });

    // Investment suggestion
    if (netActual > 0) {
      suggestions.push({ type:'action', text:`📈 You have ${formatCurrency(netActual)} surplus this period. Consider: 30% to Sanchayapatra, 30% DPS top-up, 20% emergency fund, 20% liquid savings.` });
    }

    // Expense > 80% of income warning
    const expRatio = summary.totalActualIncome > 0 ? (summary.totalActualExpense / summary.totalActualIncome) * 100 : 0;
    if (expRatio > 80) suggestions.push({ type:'warning', text:`🚨 Expenses are ${expRatio.toFixed(0)}% of income. Target max 80% (50% needs + 30% wants). Find areas to cut.` });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 md:space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">📋 Budget Planner</h1>
          <p className="text-gray-400 text-xs md:text-sm">Plan · Track · Compare Actual vs Budget</p>
        </div>
        <button onClick={() => { setEditBudget(null); setFormOpen(true); }} className="btn-primary btn-sm md:text-sm md:px-4 md:py-2">
          + New Budget
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* ── LEFT: Budget list ─────────────────────────────────── */}
        <div className="xl:w-64 flex-shrink-0">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Budget Plans</p>
            </div>
            {budgets.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-2xl mb-2">📋</p>
                <p className="text-sm text-gray-500">No budgets yet</p>
                <button onClick={() => setFormOpen(true)} className="btn-primary btn-sm mt-3 mx-auto">Create First Budget</button>
              </div>
            ) : budgets.map(b => (
              <button key={b._id}
                onClick={() => loadDetail(b._id)}
                className={`w-full text-left px-4 py-3 border-b border-surface-50 hover:bg-surface-50 transition-colors
                  ${selected?._id === b._id ? 'bg-primary-50 border-l-2 border-l-primary-600' : ''}`}>
                <p className="text-sm font-semibold text-gray-800 truncate">{b.name}</p>
                <p className="text-xs text-gray-400">
                  {b.period === 'monthly'
                    ? `${MONTHS[(b.month||1)-1]} ${b.year}`
                    : `Year ${b.year}`}
                </p>
                <div className="flex gap-2 mt-1.5">
                  <button onClick={e => { e.stopPropagation(); setEditBudget(b); setFormOpen(true); }}
                    className="text-xs text-primary-500 hover:underline">Edit</button>
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget(b); }}
                    className="text-xs text-red-400 hover:underline">Delete</button>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Budget detail ──────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {!selected ? (
            <div className="card p-12 text-center">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-gray-500 text-sm">Select a budget plan to view details</p>
            </div>
          ) : detailLoading ? <LoadingSpinner /> : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Budgeted Income',  val: formatCurrency(summary?.totalBudgetIncome),  color:'text-income'   },
                  { label: 'Actual Income',    val: formatCurrency(summary?.totalActualIncome),  color:'text-income'   },
                  { label: 'Budgeted Expense', val: formatCurrency(summary?.totalBudgetExpense), color:'text-expense'  },
                  { label: 'Actual Expense',   val: formatCurrency(summary?.totalActualExpense), color:'text-expense'  },
                ].map(s => (
                  <div key={s.label} className="card p-3">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className={`font-mono font-bold text-base md:text-lg ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Net row */}
              <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:gap-6 items-start sm:items-center">
                <div>
                  <p className="text-xs text-gray-400">Budgeted Net</p>
                  <p className={`font-mono font-bold text-lg ${summary?.budgetNet >= 0 ? 'text-income' : 'text-expense'}`}>
                    {summary?.budgetNet >= 0 ? '+' : ''}{formatCurrency(summary?.budgetNet)}
                  </p>
                </div>
                <div className="text-2xl text-gray-300">→</div>
                <div>
                  <p className="text-xs text-gray-400">Actual Net</p>
                  <p className={`font-mono font-bold text-lg ${summary?.actualNet >= 0 ? 'text-income' : 'text-expense'}`}>
                    {summary?.actualNet >= 0 ? '+' : ''}{formatCurrency(summary?.actualNet)}
                  </p>
                </div>
                <div className="sm:ml-auto text-sm text-gray-500">
                  <span className={`badge ${summary?.actualNet >= summary?.budgetNet ? 'bg-income-light text-income' : 'bg-expense-light text-expense'}`}>
                    {summary?.actualNet >= summary?.budgetNet ? '✓ On Track' : '⚠ Off Track'}
                  </span>
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="card p-4">
                  <h3 className="section-title mb-3">Budget vs Actual</h3>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -5, bottom: 40 }} barGap={2}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => [formatCurrency(v), '']} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Budget" fill="#3b5bdb" radius={[3,3,0,0]} maxBarSize={28} />
                        <Bar dataKey="Actual" radius={[3,3,0,0]} maxBarSize={28}>
                          {chartData.map((d, i) => (
                            <Cell key={i} fill={
                              d.type === 'income'
                                ? (d.Actual >= d.Budget ? '#16a34a' : '#dc2626')
                                : (d.Actual <= d.Budget ? '#16a34a' : '#dc2626')
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Income table */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 bg-income-light border-b border-income/20">
                  <p className="text-sm font-bold text-income uppercase tracking-wide">💰 Income Budget</p>
                </div>
                <div className="px-4">
                  <div className="grid grid-cols-12 gap-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-surface-100">
                    <div className="col-span-4">Account</div>
                    <div className="col-span-2 text-right">Budgeted</div>
                    {showActuals && <>
                      <div className="col-span-2 text-right">Actual</div>
                      <div className="col-span-2 text-right">Variance</div>
                      <div className="col-span-2">Progress</div>
                    </>}
                  </div>
                  {selected.incomeLines.map((l, i) => (
                    <BudgetLine key={i} line={l} isExpense={false} showActuals={showActuals} />
                  ))}
                  {selected.incomeLines.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-400 italic">No income lines budgeted</p>
                  )}
                </div>
                <SectionTotal
                  label="Total Income"
                  budgeted={summary?.totalBudgetIncome}
                  actual={summary?.totalActualIncome}
                  showActuals={showActuals}
                  color="bg-income-light border-income/30 text-income"
                />
              </div>

              {/* Expense table */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 bg-expense-light border-b border-expense/20">
                  <p className="text-sm font-bold text-expense uppercase tracking-wide">💸 Expense Budget</p>
                </div>
                <div className="px-4">
                  <div className="grid grid-cols-12 gap-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-surface-100">
                    <div className="col-span-4">Account</div>
                    <div className="col-span-2 text-right">Budgeted</div>
                    {showActuals && <>
                      <div className="col-span-2 text-right">Actual</div>
                      <div className="col-span-2 text-right">Variance</div>
                      <div className="col-span-2">Progress</div>
                    </>}
                  </div>
                  {selected.expenseLines.map((l, i) => (
                    <BudgetLine key={i} line={l} isExpense={true} showActuals={showActuals} />
                  ))}
                  {selected.expenseLines.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-400 italic">No expense lines budgeted</p>
                  )}
                </div>
                <SectionTotal
                  label="Total Expenses"
                  budgeted={summary?.totalBudgetExpense}
                  actual={summary?.totalActualExpense}
                  showActuals={showActuals}
                  color="bg-expense-light border-expense/30 text-expense"
                />
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="card p-4">
                  <h3 className="section-title mb-3">💡 Smart Suggestions</h3>
                  <div className="space-y-2">
                    {suggestions.map((s, i) => {
                      const styles = {
                        good:    'bg-income-light border-income/30 text-income',
                        warning: 'bg-amber-50 border-amber-200 text-amber-800',
                        danger:  'bg-expense-light border-expense/30 text-expense',
                        action:  'bg-indigo-50 border-indigo-200 text-indigo-800',
                      };
                      return (
                        <div key={i} className={`p-3 rounded-lg border text-sm ${styles[s.type] || styles.warning}`}>
                          {s.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <BudgetFormModal
        open={formOpen} onClose={() => setFormOpen(false)}
        onSaved={load} editBudget={editBudget} accounts={accounts}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Budget" confirmLabel="Delete"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
