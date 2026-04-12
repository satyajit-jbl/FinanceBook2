import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import api from '../utils/api';
import { formatCurrency, formatDate, txnTypeLabel, txnTypeColor } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const PIE_COLORS = ['#3b5bdb','#16a34a','#dc2626','#9333ea','#ea580c','#0891b2','#d97706','#0f766e'];

/* Custom legend rendered OUTSIDE the PieChart so it never overflows */
function PieLegend({ data }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
      {data.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
          <span className="text-xs text-gray-500 truncate">{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { dbUser } = useAuth();
  const [bsData, setBsData] = useState(null);
  const [isData, setIsData] = useState(null);
  const [txns,   setTxns]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [bsRes, isRes, txnRes] = await Promise.all([
          api.get('/reports/balance-sheet'),
          api.get('/reports/income-statement'),
          api.get('/transactions?limit=8'),
        ]);
        setBsData(bsRes.data);
        setIsData(isRes.data);
        setTxns(txnRes.data.transactions || []);
      } catch (err) { console.error('Dashboard load error:', err); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  const barData = [
    { name: 'Revenue',    amount: isData?.totalRevenue  || 0, fill: '#16a34a' },
    { name: 'Expenses',   amount: isData?.totalExpenses || 0, fill: '#dc2626' },
    { name: 'Net Income', amount: Math.abs(isData?.netIncome || 0), fill: isData?.netIncome >= 0 ? '#3b5bdb' : '#ea580c' },
  ];

  const expPieData = (isData?.expenseAccounts || [])
    .filter(r => r.displayAmount > 0)
    .sort((a, b) => b.displayAmount - a.displayAmount)
    .slice(0, 6)                              // max 6 for clean legend
    .map(r => ({ name: r.accountTitle, value: r.displayAmount }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-400 text-xs md:text-sm">Welcome back, {dbUser?.displayName}</p>
        </div>
        <Link to="/transactions/new" className="btn-primary btn-sm md:text-sm md:px-4 md:py-2">
          + <span className="hidden sm:inline">New </span>Transaction
        </Link>
      </div>

      {/* KPI cards — 2 cols on small, 4 on large */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Assets"      value={formatCurrency(bsData?.totalAssets)}      icon="🏦" color="blue" />
        <StatCard title="Liabilities"       value={formatCurrency(bsData?.totalLiabilities)} icon="📋" color="red" />
        <StatCard title="Equity"            value={formatCurrency(bsData?.totalEquity)}       icon="💎" color="green" />
        <StatCard
          title="Net Income"
          value={formatCurrency(Math.abs(isData?.netIncome || 0))}
          icon={isData?.netIncome >= 0 ? '📈' : '📉'}
          color={isData?.netIncome >= 0 ? 'green' : 'red'}
          sub={isData?.netIncome >= 0 ? 'Surplus' : 'Deficit'}
        />
      </div>

      {/* Balance Sheet status */}
      {bsData && (
        <div className={`px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium flex flex-wrap items-center gap-1.5
          ${bsData.isBalanced ? 'bg-income-light text-income' : 'bg-expense-light text-expense'}`}>
          <span>{bsData.isBalanced ? '✓' : '⚠️'}</span>
          <span>Balance Sheet {bsData.isBalanced ? 'BALANCED' : 'UNBALANCED'}</span>
          <span className="hidden sm:inline">—
            Assets <strong>{formatCurrency(bsData.totalAssets)}</strong> =
            Liabilities <strong>{formatCurrency(bsData.totalLiabilities)}</strong> +
            Equity <strong>{formatCurrency(bsData.totalEquity)}</strong>
          </span>
        </div>
      )}

      {/* Charts — stacked on small, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar chart */}
        <div className="card p-4">
          <h3 className="section-title mb-3">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={40} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [formatCurrency(v), '']} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="amount" radius={[5,5,0,0]}>
                {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Mini summary */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label:'Revenue',  val: isData?.totalRevenue,  color:'text-income' },
              { label:'Expenses', val: isData?.totalExpenses, color:'text-expense' },
              { label:'Net',      val: Math.abs(isData?.netIncome || 0), color: isData?.netIncome >= 0 ? 'text-primary-600' : 'text-orange-500' },
            ].map(s => (
              <div key={s.label} className="bg-surface-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className={`font-mono font-bold text-xs md:text-sm ${s.color}`}>{formatCurrency(s.val || 0)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pie chart — fixed overflow by using controlled height + external legend */}
        <div className="card p-4">
          <h3 className="section-title mb-3">Expense Breakdown</h3>
          {expPieData.length > 0 ? (
            <>
              {/* Fixed height container; pie sits fully inside */}
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Pie
                      data={expPieData}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={70}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {expPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => [formatCurrency(v), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* External legend — no overflow possible */}
              <PieLegend data={expPieData} />
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-300 text-sm">No expense data</div>
          )}
        </div>
      </div>

      {/* Balance Sheet summary — hide on smallest screens */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Assets */}
        <div className="card p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Assets</h3>
          {['Current Assets','Investments','Fixed Assets'].map(sub => {
            const total = (bsData?.assetAccounts || []).filter(a => a.subAccount === sub).reduce((s, a) => s + a.currentBalance, 0);
            if (!total) return null;
            return (
              <div key={sub} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{sub}</span>
                <span className="font-mono text-xs font-semibold text-gray-800">{formatCurrency(total)}</span>
              </div>
            );
          })}
          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
            <span className="text-xs font-bold text-gray-700">Total Assets</span>
            <span className="font-mono text-sm font-bold text-primary-700">{formatCurrency(bsData?.totalAssets)}</span>
          </div>
        </div>

        {/* Liabilities */}
        <div className="card p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Liabilities</h3>
          {['Current Liabilities','Short-term Liabilities','Long-term Liabilities'].map(sub => {
            const total = (bsData?.liabilityAccounts || []).filter(a => a.subAccount === sub).reduce((s, a) => s + (-a.currentBalance), 0);
            if (!total) return null;
            return (
              <div key={sub} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{sub}</span>
                <span className="font-mono text-xs font-semibold text-gray-800">{formatCurrency(total)}</span>
              </div>
            );
          })}
          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
            <span className="text-xs font-bold text-gray-700">Total Liabilities</span>
            <span className="font-mono text-sm font-bold text-expense">{formatCurrency(bsData?.totalLiabilities)}</span>
          </div>
        </div>

        {/* Equity */}
        <div className="card p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Owner's Equity</h3>
          {(bsData?.equityAccounts || []).map(a => (
            <div key={a._id} className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-xs text-gray-500 truncate mr-2">{a.accountTitle}</span>
              <span className="font-mono text-xs font-semibold text-gray-800">{formatCurrency(-a.currentBalance)}</span>
            </div>
          ))}
          <div className="flex justify-between py-1.5 border-b border-gray-50">
            <span className="text-xs text-gray-500">Net Income</span>
            <span className={`font-mono text-xs font-semibold ${bsData?.netIncome >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatCurrency(Math.abs(bsData?.netIncome || 0))}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
            <span className="text-xs font-bold text-gray-700">Total Equity</span>
            <span className="font-mono text-sm font-bold text-income">{formatCurrency(bsData?.totalEquity)}</span>
          </div>
          {bsData?.isBalanced && (
            <div className="mt-2 text-center">
              <span className="badge bg-income-light text-income text-xs">⚖️ Balanced</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
          <h3 className="section-title">Recent Transactions</h3>
          <Link to="/transactions" className="text-xs text-primary-600 hover:underline font-medium">View All →</Link>
        </div>
        {txns.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            No transactions yet.{' '}
            <Link to="/transactions/new" className="text-primary-600 hover:underline">Create one →</Link>
          </div>
        ) : (
          <div className="divide-y divide-surface-50">
            {txns.map(txn => (
              <div key={txn._id}
                className={`flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors
                  ${txn.status === 'void' ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`badge flex-shrink-0 ${txnTypeColor(txn.transactionType)}`}>
                    <span className="hidden sm:inline">{txnTypeLabel(txn.transactionType)}</span>
                    <span className="sm:hidden">{txnTypeLabel(txn.transactionType).split(' ')[0]}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{txn.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(txn.date)}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="font-mono font-semibold text-sm text-gray-800">{formatCurrency(txn.totalAmount)}</p>
                  {txn.status === 'void' && <span className="badge bg-gray-100 text-gray-500 text-xs">Voided</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
