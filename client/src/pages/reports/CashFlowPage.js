import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { formatCurrency, today } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

/*
 * Cash Flow — Indirect Method
 *
 * Cash items (accountType='Cash': Cash in Hand, Emergency Stock, BD New Notes & Bundles)
 * are EXCLUDED from activity sections — they ARE the cash.
 * Ending Cash Balance = sum of all Cash-type account balances.
 */

function CashRow({ label, amount, indent = false }) {
  const neg = amount < 0;
  return (
    <div className={`flex justify-between items-center px-5 py-2 border-b border-surface-50 hover:bg-surface-50 ${indent ? 'pl-10' : ''}`}>
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`font-mono text-sm font-semibold ${neg ? 'text-expense' : 'text-income'}`}>
        {neg ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
      </span>
    </div>
  );
}

function SectionTotal({ label, amount, bg, color }) {
  const neg = amount < 0;
  return (
    <div className={`flex justify-between items-center px-5 py-3 border-b ${bg}`}>
      <span className={`font-bold text-sm ${color}`}>{label}</span>
      <span className={`font-mono font-bold text-base ${neg ? 'text-expense' : color}`}>
        {neg ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
      </span>
    </div>
  );
}

const TYPE_LABELS = {
  'Savings Bank Account': 'Bank Accounts',
  'Digital Wallet': 'Digital Wallets',
  'Fixed Deposit Account': 'Fixed Deposit Accounts',
  'DPS Account': 'DPS / Smart Accounts',
  'Accounts Receivable (Lending)': 'Accounts Receivable',
  'Savings Certificate': 'Savings Certificates',
  'investment': 'Investments', 'Investment': 'Investments',
  'Insurence': 'Insurance',    'Share': 'Shares / Securities',
  'Other account': 'Other',    'Fixed Assets': 'Fixed Assets',
  'Credit Card': 'Credit Cards', 'Borrowings': 'Borrowings / Payables',
  'Other': 'Other Liabilities',
  'Short-term Loans': 'Short-term Loans',
  'Long-term Liabilities': 'Long-term Loans',
  'Equity': 'Owner\'s Capital',
};

function ActivitySection({ title, icon, rows, net, bg, color }) {
  const grouped = rows.reduce((g, r) => {
    const k = r.accountType || 'Other';
    if (!g[k]) g[k] = [];
    g[k].push(r);
    return g;
  }, {});

  return (
    <div className="card overflow-hidden">
      <div className={`px-5 py-3 ${bg} text-white flex items-center gap-2`}>
        <span className="text-lg">{icon}</span>
        <h3 className="font-bold text-sm uppercase tracking-wide">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400 italic">No activity in this period</p>
      ) : (
        Object.entries(grouped).map(([type, typeRows]) => {
          const typeTotal = typeRows.reduce((s, r) => s + r.cashImpact, 0);
          return (
            <div key={type}>
              <div className="px-5 py-1.5 bg-surface-50 border-b border-surface-100">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {TYPE_LABELS[type] || type}
                </span>
              </div>
              {typeRows.map(r => (
                <CashRow key={r._id} label={r.accountTitle} amount={r.cashImpact} indent />
              ))}
              <div className="flex justify-between items-center px-5 py-1.5 bg-surface-100 border-b border-surface-200 pl-10">
                <span className="text-xs font-semibold text-gray-400">Subtotal</span>
                <span className={`font-mono text-xs font-bold ${typeTotal < 0 ? 'text-expense' : 'text-income'}`}>
                  {typeTotal < 0 ? `(${formatCurrency(Math.abs(typeTotal))})` : formatCurrency(typeTotal)}
                </span>
              </div>
            </div>
          );
        })
      )}

      <SectionTotal
        label={`Net ${title}`}
        amount={net}
        bg={`${bg} text-white`}
        color="text-white"
      />
    </div>
  );
}

export default function CashFlowPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/reports/cash-flow');
      setData(res);
    } catch (err) { toast.error(err.message || 'Failed to load cash flow'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const netFromOps = data ? data.netIncome + data.netOperating : 0;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Flow Statement</h1>
          <p className="text-gray-400 text-sm">Indirect Method · All Time</p>
        </div>
        <button onClick={() => window.print()} className="btn btn-secondary no-print">🖨 Print</button>
      </div>

      {/* Summary banner */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Net Income',  val: data.netIncome,    icon: '📊' },
            { label: 'Operating',   val: data.netOperating, icon: '⚙️' },
            { label: 'Investing',   val: data.netInvesting, icon: '📈' },
            { label: 'Financing',   val: data.netFinancing, icon: '🏦' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <span>{s.icon}</span>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
              </div>
              <p className={`font-mono font-bold text-lg ${s.val < 0 ? 'text-expense' : 'text-income'}`}>
                {s.val < 0 ? `(${formatCurrency(Math.abs(s.val))})` : formatCurrency(s.val)}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? <LoadingSpinner /> : data && (
        <>
          {/* ── OPERATING ── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-primary-600 text-white flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <h3 className="font-bold text-sm uppercase tracking-wide">Cash Flow from Operating Activities</h3>
            </div>
            <CashRow label="Net Income" amount={data.netIncome} />
            <div className="px-5 py-1.5 bg-surface-50 border-b border-surface-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Changes in Working Capital</span>
            </div>
            {data.operatingRows.length === 0 ? (
              <p className="px-5 py-3 text-sm text-gray-400 italic">No working capital changes</p>
            ) : (() => {
              const grouped = data.operatingRows.reduce((g, r) => {
                const k = r.accountType || 'Other';
                if (!g[k]) g[k] = [];
                g[k].push(r);
                return g;
              }, {});
              return Object.entries(grouped).map(([type, rows]) => {
                const sub = rows.reduce((s, r) => s + r.cashImpact, 0);
                return (
                  <div key={type}>
                    <div className="px-5 py-1 bg-blue-50/40 border-b border-blue-100">
                      <span className="text-xs font-semibold text-gray-400">{TYPE_LABELS[type] || type}</span>
                    </div>
                    {rows.map(r => <CashRow key={r._id} label={r.accountTitle} amount={r.cashImpact} indent />)}
                  </div>
                );
              });
            })()}
            <div className="flex justify-between items-center px-5 py-2 bg-blue-50 border-b border-blue-200">
              <span className="text-sm font-semibold text-gray-600">Net Changes in Working Capital</span>
              <span className={`font-mono font-bold text-sm ${data.netOperating < 0 ? 'text-expense' : 'text-income'}`}>
                {data.netOperating < 0 ? `(${formatCurrency(Math.abs(data.netOperating))})` : formatCurrency(data.netOperating)}
              </span>
            </div>
            <SectionTotal
              label="NET CASH FROM OPERATING ACTIVITIES"
              amount={netFromOps}
              bg="bg-primary-600 text-white"
              color="text-white"
            />
          </div>

          {/* ── INVESTING ── */}
          <ActivitySection
            title="Cash Flow from Investing Activities"
            icon="📈"
            rows={data.investingRows}
            net={data.netInvesting}
            bg="bg-indigo-600"
            color="text-indigo-700"
          />

          {/* ── FINANCING ── */}
          <ActivitySection
            title="Cash Flow from Financing Activities"
            icon="🏦"
            rows={data.financingRows}
            net={data.netFinancing}
            bg="bg-purple-600"
            color="text-purple-700"
          />

          {/* ── ENDING CASH BALANCE ── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-2.5 bg-surface-50 border-b border-surface-200">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cash & Cash Equivalent</h3>
            </div>

            {/* Individual cash accounts */}
            {(data.cashItems || []).map(item => (
              <div key={item._id} className="flex justify-between items-center px-5 py-2.5 border-b border-surface-50 hover:bg-surface-50 pl-9">
                <span className="text-sm text-gray-700">{item.accountTitle}</span>
                <span className={`font-mono text-sm font-semibold ${item.currentBalance < 0 ? 'text-expense' : 'text-gray-800'}`}>
                  {item.currentBalance < 0
                    ? `(${formatCurrency(Math.abs(item.currentBalance))})`
                    : formatCurrency(item.currentBalance)}
                </span>
              </div>
            ))}

            {/* Opening balance line */}
            <div className="flex justify-between items-center px-5 py-2.5 bg-surface-50 border-b border-surface-200">
              <span className="font-semibold text-sm text-gray-700">Opening Cash Balance</span>
              <span className="font-mono font-semibold text-gray-600">৳ 0.00</span>
            </div>

            {/* Ending balance */}
            <div className="flex justify-between items-center px-5 py-4 bg-gray-900 text-white">
              <span className="font-bold text-base">ENDING CASH BALANCE</span>
              <span className={`font-mono font-bold text-xl ${data.endingCash < 0 ? 'text-red-300' : 'text-green-300'}`}>
                {data.endingCash < 0
                  ? `(${formatCurrency(Math.abs(data.endingCash))})`
                  : formatCurrency(data.endingCash)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
