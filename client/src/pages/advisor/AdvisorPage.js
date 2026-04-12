import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

/*
 * ─────────────────────────────────────────────────────────────────
 * Financial Advisor — Pure ratio analysis, NO external API calls.
 * All calculations are done client-side from the user's own data.
 * Free forever. Works offline. Production-grade accuracy.
 * ─────────────────────────────────────────────────────────────────
 *
 * FREE AI API OPTIONS (for future reference):
 *  • Google Gemini API  — gemini-1.5-flash is FREE (15 req/min, 1M req/day)
 *    https://ai.google.dev/  — just needs a Google account
 *  • Groq API           — FREE tier (generous limits, very fast)
 *    https://console.groq.com/
 *  • OpenRouter         — FREE models available (meta-llama, mistral etc.)
 *    https://openrouter.ai/
 *  • Cohere             — FREE trial / command-r-08-2024
 *    https://cohere.com/
 * All of the above can be called from the backend (not browser) securely.
 */

// ─── Benchmark constants ─────────────────────────────────────────
const BENCH = {
  savingsRate:     { good: 20, fair: 10 },    // % of income saved
  debtRatio:       { good: 40, fair: 60 },    // total debt / total assets %
  currentRatio:    { good: 2,  fair: 1 },     // current assets / current liab
  debtToIncome:    { good: 30, fair: 50 },    // total debt / annual income %
  expenseRatio:    { good: 60, fair: 80 },    // expenses / income %
  investmentShare: { good: 30, fair: 15 },    // investments / total assets %
};

// ─── Score helper: returns 'green' | 'yellow' | 'red' ────────────
const score = (val, bench, lowerIsBetter = false) => {
  if (lowerIsBetter) {
    if (val <= bench.good) return 'green';
    if (val <= bench.fair) return 'yellow';
    return 'red';
  }
  if (val >= bench.good) return 'green';
  if (val >= bench.fair) return 'yellow';
  return 'red';
};

const STATUS = {
  green:  { label: '🟢 Good',    bg: 'bg-income-light',   text: 'text-income',   bar: 'bg-income'   },
  yellow: { label: '🟡 Fair',    bg: 'bg-yellow-50',      text: 'text-yellow-700', bar: 'bg-yellow-400' },
  red:    { label: '🔴 Needs Work', bg: 'bg-expense-light', text: 'text-expense', bar: 'bg-expense'  },
};

// ─── Number safe helpers ──────────────────────────────────────────
const safe = (n) => (isFinite(n) && !isNaN(n) ? n : 0);
const pct  = (n, d) => d === 0 ? 0 : safe((n / d) * 100);
const yrs  = (d, r) => (r <= 0 ? null : Math.ceil(d / r)); // years to pay off

// ─── Progress bar component ───────────────────────────────────────
function Bar({ pctVal, color = 'bg-primary-600', max = 100 }) {
  const w = Math.min(100, Math.max(0, (pctVal / max) * 100));
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

// ─── Metric row ───────────────────────────────────────────────────
function MetricRow({ label, value, status, benchmark, detail }) {
  const s = STATUS[status];
  return (
    <div className="py-3 border-b border-surface-50 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-gray-900">{value}</span>
          <span className={`badge ${s.bg} ${s.text} text-xs`}>{s.label}</span>
        </div>
      </div>
      <Bar pctVal={parseFloat(value)} color={s.bar} />
      {benchmark && <p className="text-xs text-gray-400 mt-1">Benchmark: {benchmark}</p>}
      {detail && <p className="text-xs text-gray-500 mt-0.5 italic">{detail}</p>}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────
function Section({ icon, title, color, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r ${color} text-white text-left`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="font-bold text-sm md:text-base">{title}</span>
        </div>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 py-2">{children}</div>}
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────
function Insight({ type, text }) {
  const styles = {
    tip:     { icon: '💡', bg: 'bg-blue-50   border-blue-200',   text: 'text-blue-800'   },
    warning: { icon: '⚠️', bg: 'bg-amber-50  border-amber-200',  text: 'text-amber-800'  },
    danger:  { icon: '🚨', bg: 'bg-red-50    border-red-200',    text: 'text-red-800'    },
    good:    { icon: '✅', bg: 'bg-green-50  border-green-200',  text: 'text-green-800'  },
    action:  { icon: '🎯', bg: 'bg-violet-50 border-violet-200', text: 'text-violet-800' },
  };
  const s = styles[type] || styles.tip;
  return (
    <div className={`flex gap-2.5 p-3 rounded-lg border ${s.bg} mb-2`}>
      <span className="text-base flex-shrink-0 mt-0.5">{s.icon}</span>
      <p className={`text-xs md:text-sm ${s.text} leading-relaxed`}>{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function AdvisorPage() {
  const [bs, setBs]           = useState(null);
  const [is, setIs]           = useState(null);
  const [cf, setCf]           = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [bsR, isR, cfR] = await Promise.all([
          api.get('/reports/balance-sheet'),
          api.get('/reports/income-statement'),
          api.get('/reports/cash-flow'),
        ]);
        setBs(bsR.data);
        setIs(isR.data);
        setCf(cfR.data);
      } catch { toast.error('Failed to load financial data'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  // ── Extract raw numbers ─────────────────────────────────────────
  const totalAssets    = safe(bs?.totalAssets);
  const totalLiab      = safe(bs?.totalLiabilities);
  const totalEquity    = safe(bs?.totalEquity);
  const totalRevenue   = safe(is?.totalRevenue);
  const totalExpenses  = safe(is?.totalExpenses);
  const netIncome      = safe(is?.netIncome);
  const incomeTax      = safe(is?.incomeTax);
  const endingCash     = safe(cf?.endingCash);

  // Current assets & current liabilities
  const currentAssets  = (bs?.assetAccounts || [])
    .filter(a => a.subAccount === 'Current Assets')
    .reduce((s, a) => s + safe(a.currentBalance), 0);
  const currentLiab    = (bs?.liabilityAccounts || [])
    .filter(a => a.subAccount === 'Current Liabilities')
    .reduce((s, a) => s + safe(-a.currentBalance), 0);
  const longTermDebt   = (bs?.liabilityAccounts || [])
    .filter(a => a.subAccount === 'Long-term Liabilities')
    .reduce((s, a) => s + safe(-a.currentBalance), 0);
  const totalInvestments = (bs?.assetAccounts || [])
    .filter(a => a.subAccount === 'Investments')
    .reduce((s, a) => s + safe(a.currentBalance), 0);
  const fixedAssets    = (bs?.assetAccounts || [])
    .filter(a => a.subAccount === 'Fixed Assets')
    .reduce((s, a) => s + safe(a.currentBalance), 0);

  // Monthly figures
  const monthlyIncome   = totalRevenue  / 12;
  const monthlyExpenses = totalExpenses / 12;
  const monthlySurplus  = monthlyIncome - monthlyExpenses;
  const annualSurplus   = totalRevenue - totalExpenses;

  // ── Key Ratios ──────────────────────────────────────────────────
  const savingsRatePct     = pct(annualSurplus, totalRevenue);
  const debtRatioPct       = pct(totalLiab, totalAssets);
  const currentRatio       = currentLiab === 0 ? 999 : safe(currentAssets / currentLiab);
  const debtToIncomePct    = pct(totalLiab, totalRevenue);
  const expenseRatioPct    = pct(totalExpenses, totalRevenue);
  const investmentSharePct = pct(totalInvestments, totalAssets);
  const returnOnAssets     = pct(netIncome, totalAssets);
  const netWorthToIncome   = totalRevenue === 0 ? 0 : safe(totalEquity / totalRevenue);
  const debtServiceMonths  = monthlySurplus > 0 ? safe(totalLiab / monthlySurplus) : null;
  const cashBuffer         = monthlyExpenses > 0 ? safe(endingCash / monthlyExpenses) : 0;

  // ── Debt payoff scenarios ───────────────────────────────────────
  const monthsNormal  = monthlySurplus > 0 ? Math.ceil(totalLiab / monthlySurplus) : null;
  const months10pct   = monthlySurplus > 0 ? Math.ceil(totalLiab / (monthlySurplus * 1.10)) : null;
  const months20pct   = monthlySurplus > 0 ? Math.ceil(totalLiab / (monthlySurplus * 1.20)) : null;

  // ── Weekly check-in metrics ─────────────────────────────────────
  const weeklyBudget      = monthlyExpenses / 4.33;
  const weeklyIncome      = monthlyIncome   / 4.33;
  const weeklySaving      = monthlySurplus  / 4.33;

  // ── Investment projections (compound interest, 8% pa) ──────────
  const proj = (pv, pmt, r, n) => pv * Math.pow(1 + r, n) + pmt * ((Math.pow(1 + r, n) - 1) / r);
  const annualRate = 0.08;
  const monthly    = annualRate / 12;
  const inv1yr  = proj(totalInvestments, Math.max(0, monthlySurplus * 0.5), monthly, 12);
  const inv3yr  = proj(totalInvestments, Math.max(0, monthlySurplus * 0.5), monthly, 36);
  const inv5yr  = proj(totalInvestments, Math.max(0, monthlySurplus * 0.5), monthly, 60);

  // ── Generate insights ───────────────────────────────────────────
  const insights = {
    dashboard: [],
    debt: [],
    lifestyle: [],
    wealth: [],
    weekly: [],
    investment: [],
  };

  // -- Dashboard insights
  if (savingsRatePct >= 20) insights.dashboard.push({ type: 'good', text: `Your savings rate of ${savingsRatePct.toFixed(1)}% is above the recommended 20% benchmark. You're building wealth consistently.` });
  else if (savingsRatePct > 0) insights.dashboard.push({ type: 'warning', text: `Your savings rate is ${savingsRatePct.toFixed(1)}%. Try to reach 20%. Even saving ${formatCurrency(totalRevenue * 0.02 / 12)} more per month gets you there.` });
  else insights.dashboard.push({ type: 'danger', text: `You're spending more than you earn. This is the most urgent issue — find ${formatCurrency(-annualSurplus / 12)} in monthly savings immediately.` });

  if (currentRatio >= 2) insights.dashboard.push({ type: 'good', text: `Current ratio of ${currentRatio.toFixed(2)}x means you can cover short-term obligations comfortably.` });
  else if (currentRatio >= 1) insights.dashboard.push({ type: 'warning', text: `Current ratio of ${currentRatio.toFixed(2)}x is tight. Keep at least 1 month of expenses as cash buffer.` });
  else insights.dashboard.push({ type: 'danger', text: `Current ratio below 1.0 means current liabilities exceed current assets — risk of cash flow problems.` });

  if (debtRatioPct < 40) insights.dashboard.push({ type: 'good', text: `Debt ratio of ${debtRatioPct.toFixed(1)}% is healthy. Most of your assets are unencumbered.` });
  else if (debtRatioPct < 60) insights.dashboard.push({ type: 'warning', text: `Debt ratio of ${debtRatioPct.toFixed(1)}% is moderate. Avoid taking on new debt until this drops below 40%.` });
  else insights.dashboard.push({ type: 'danger', text: `Debt ratio of ${debtRatioPct.toFixed(1)}% is high — over 60% of your assets are financed by debt.` });

  // -- Debt insights
  if (monthsNormal !== null) {
    insights.debt.push({ type: 'tip', text: `At your current surplus of ${formatCurrency(monthlySurplus)}/month, it will take approximately ${monthsNormal} months (${(monthsNormal/12).toFixed(1)} years) to pay off all debt.` });
    if (months10pct !== null) insights.debt.push({ type: 'action', text: `Increasing monthly payments by 10% (${formatCurrency(monthlySurplus * 0.1)}/month) reduces payoff to ${months10pct} months — saving ${monthsNormal - months10pct} months.` });
    if (months20pct !== null) insights.debt.push({ type: 'action', text: `Increasing by 20% (${formatCurrency(monthlySurplus * 0.2)}/month) reduces payoff to ${months20pct} months — saving ${monthsNormal - months20pct} months.` });
  } else {
    insights.debt.push({ type: 'danger', text: `With a negative monthly surplus, debt is growing. You must reduce expenses or increase income before making meaningful debt progress.` });
  }
  if (longTermDebt > totalRevenue * 2) {
    insights.debt.push({ type: 'warning', text: `Long-term debt of ${formatCurrency(longTermDebt)} is more than 2× your annual income. Prioritize high-interest debt first (avalanche method).` });
  }

  // -- Lifestyle inflation
  const topExpenses = (is?.expenseAccounts || [])
    .filter(a => a.displayAmount > 0)
    .sort((a, b) => b.displayAmount - a.displayAmount)
    .slice(0, 5);
  topExpenses.forEach(e => {
    const share = pct(e.displayAmount, totalExpenses);
    if (share > 25) insights.lifestyle.push({ type: 'warning', text: `"${e.accountTitle}" is ${share.toFixed(1)}% of total expenses (${formatCurrency(e.displayAmount)}). This single category dominates your spending.` });
  });
  if (expenseRatioPct > 80) insights.lifestyle.push({ type: 'danger', text: `You're spending ${expenseRatioPct.toFixed(1)}% of income. The 50/30/20 rule targets max 80% on needs+wants combined.` });
  else insights.lifestyle.push({ type: 'good', text: `Expense ratio of ${expenseRatioPct.toFixed(1)}% leaves room for saving and investing.` });

  // -- Wealth insights
  if (investmentSharePct >= 30) insights.wealth.push({ type: 'good', text: `${investmentSharePct.toFixed(1)}% of assets are in investments — excellent wealth-building position.` });
  else insights.wealth.push({ type: 'action', text: `Only ${investmentSharePct.toFixed(1)}% of assets are in growth investments. Aim for 30%+ by redirecting surplus to Sanchayapatra, DPS, or equities.` });
  if (cashBuffer < 3) insights.wealth.push({ type: 'warning', text: `Cash buffer of ${cashBuffer.toFixed(1)} months is below the recommended 3–6 months emergency fund.` });
  else insights.wealth.push({ type: 'good', text: `Cash buffer of ${cashBuffer.toFixed(1)} months is adequate. Keep 3–6 months as the target.` });

  // -- Investment insights
  insights.investment.push({ type: 'tip', text: `If you invest 50% of your current surplus (${formatCurrency(monthlySurplus * 0.5)}/month) at 8% annual return: 1yr → ${formatCurrency(inv1yr)}, 3yr → ${formatCurrency(inv3yr)}, 5yr → ${formatCurrency(inv5yr)}.` });
  if (totalInvestments > 0) {
    insights.investment.push({ type: 'good', text: `Existing investment portfolio of ${formatCurrency(totalInvestments)} is your compounding engine. Don't withdraw from this unless absolutely necessary.` });
  }
  insights.investment.push({ type: 'action', text: `Bangladesh priority order: (1) Emergency fund 3–6 months, (2) Pay high-interest debt, (3) Sanchayapatra (government-backed, tax benefits), (4) DPS accounts, (5) Stock market/mutual funds.` });

  // ── Overall health score ────────────────────────────────────────
  const scores = [
    score(savingsRatePct, BENCH.savingsRate),
    score(debtRatioPct,   BENCH.debtRatio,   true),
    score(currentRatio,   BENCH.currentRatio),
    score(debtToIncomePct,BENCH.debtToIncome, true),
    score(expenseRatioPct,BENCH.expenseRatio, true),
    score(investmentSharePct, BENCH.investmentShare),
  ];
  const greenCount  = scores.filter(s => s === 'green').length;
  const yellowCount = scores.filter(s => s === 'yellow').length;
  const healthScore = Math.round(((greenCount * 2 + yellowCount) / (scores.length * 2)) * 100);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 md:space-y-5 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">🤖 Financial Advisor</h1>
          <p className="text-gray-400 text-xs md:text-sm mt-0.5">
            Ratio-based analysis • 100% free • No external API
          </p>
        </div>
      </div>

      {/* ── OVERALL HEALTH SCORE ───────────────────────────────── */}
      <div className="card p-5 bg-gradient-to-r from-primary-600 to-indigo-700 text-white border-0">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
          {/* Circular score */}
          <div className="flex-shrink-0">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.2)" strokeWidth="10" fill="none" />
                <circle cx="50" cy="50" r="42" stroke="white" strokeWidth="10" fill="none"
                  strokeDasharray={`${healthScore * 2.64} 264`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white">{healthScore}</span>
                <span className="text-white/70 text-xs">/ 100</span>
              </div>
            </div>
            <p className="text-center text-white/80 text-xs mt-1">Health Score</p>
          </div>
          {/* KPI grid */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {[
              { label: 'Net Worth',     val: formatCurrency(totalEquity)       },
              { label: 'Monthly Net',   val: formatCurrency(monthlySurplus)    },
              { label: 'Savings Rate',  val: `${savingsRatePct.toFixed(1)}%`  },
              { label: 'Debt Ratio',    val: `${debtRatioPct.toFixed(1)}%`    },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3">
                <p className="font-bold font-mono text-sm md:text-base">{s.val}</p>
                <p className="text-white/60 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 1. INSTANT MONEY DASHBOARD ─────────────────────────── */}
      <Section icon="⚡" title="Instant Money Dashboard" color="from-blue-600 to-primary-700">
        <div className="py-2 space-y-0">
          <MetricRow
            label="Savings Rate"
            value={`${savingsRatePct.toFixed(1)}%`}
            status={score(savingsRatePct, BENCH.savingsRate)}
            benchmark="≥20% Good · ≥10% Fair"
            detail={`You save ${formatCurrency(annualSurplus / 12)}/month on average`}
          />
          <MetricRow
            label="Debt Ratio (Debt / Assets)"
            value={`${debtRatioPct.toFixed(1)}%`}
            status={score(debtRatioPct, BENCH.debtRatio, true)}
            benchmark="≤40% Good · ≤60% Fair"
          />
          <MetricRow
            label="Current Ratio (Current Assets / Current Liab)"
            value={currentRatio >= 99 ? 'No Current Debt' : currentRatio.toFixed(2)}
            status={currentRatio >= 99 ? 'green' : score(currentRatio, BENCH.currentRatio)}
            benchmark="≥2.0 Good · ≥1.0 Fair"
          />
          <MetricRow
            label="Expense Ratio (Expenses / Income)"
            value={`${expenseRatioPct.toFixed(1)}%`}
            status={score(expenseRatioPct, BENCH.expenseRatio, true)}
            benchmark="≤60% Good · ≤80% Fair"
          />
          <MetricRow
            label="Investment Share (Investments / Assets)"
            value={`${investmentSharePct.toFixed(1)}%`}
            status={score(investmentSharePct, BENCH.investmentShare)}
            benchmark="≥30% Good · ≥15% Fair"
            detail={formatCurrency(totalInvestments) + ' in investments'}
          />
          <MetricRow
            label="Cash Buffer (Cash / Monthly Expenses)"
            value={`${cashBuffer.toFixed(1)} months`}
            status={score(cashBuffer, { good: 6, fair: 3 })}
            benchmark="≥6 months Good · ≥3 Fair"
            detail={`${formatCurrency(endingCash)} cash available`}
          />
        </div>
        <div className="pt-3 pb-1 space-y-2">
          {insights.dashboard.map((ins, i) => <Insight key={i} {...ins} />)}
        </div>
      </Section>

      {/* ── 2. DEBT ESCAPE VELOCITY ────────────────────────────── */}
      <Section icon="🚀" title="Debt Escape Velocity Calculator" color="from-red-500 to-orange-600">
        <div className="py-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Debt',           val: formatCurrency(totalLiab),    sub: 'All liabilities' },
            { label: 'Monthly Surplus',       val: formatCurrency(monthlySurplus), sub: 'Available to repay' },
            { label: 'Debt-to-Income Ratio',  val: `${debtToIncomePct.toFixed(1)}%`, sub: debtToIncomePct <= 30 ? '✓ Healthy' : debtToIncomePct <= 50 ? '⚠ Fair' : '⚠ High' },
          ].map(s => (
            <div key={s.label} className="bg-surface-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="font-bold font-mono text-base text-gray-900">{s.val}</p>
              <p className="text-xs text-gray-500">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Payoff timeline */}
        {monthsNormal !== null ? (
          <div className="mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Payoff Timeline Scenarios</p>
            <div className="space-y-2.5">
              {[
                { label: 'At current rate',    months: monthsNormal, extra: 0 },
                { label: '+10% extra payment', months: months10pct,  extra: monthlySurplus * 0.10 },
                { label: '+20% extra payment', months: months20pct,  extra: monthlySurplus * 0.20 },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3">
                  <div className="w-36 flex-shrink-0">
                    <p className="text-xs text-gray-600 font-medium">{r.label}</p>
                    {r.extra > 0 && <p className="text-xs text-gray-400">(+{formatCurrency(r.extra)}/mo)</p>}
                  </div>
                  <div className="flex-1">
                    <Bar pctVal={r.months} color="bg-primary-500" max={monthsNormal * 1.1} />
                  </div>
                  <div className="w-24 text-right flex-shrink-0">
                    <p className="font-mono font-bold text-sm text-gray-900">{r.months} mo</p>
                    <p className="text-xs text-gray-400">{(r.months / 12).toFixed(1)} yrs</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Insight type="danger" text="Monthly expenses exceed income — focus on increasing income or cutting costs before debt repayment strategy." />
        )}

        {/* Top liabilities */}
        {(bs?.liabilityAccounts || []).filter(a => -a.currentBalance > 0).slice(0, 5).map(a => (
          <div key={a._id} className="flex justify-between items-center py-2 border-b border-surface-50">
            <span className="text-sm text-gray-700">{a.accountTitle}</span>
            <div className="text-right">
              <span className="font-mono text-sm font-semibold text-expense">{formatCurrency(-a.currentBalance)}</span>
              {monthlySurplus > 0 && <p className="text-xs text-gray-400">{Math.ceil(-a.currentBalance / monthlySurplus)} mo</p>}
            </div>
          </div>
        ))}
        <div className="pt-3 pb-1 space-y-2">
          {insights.debt.map((ins, i) => <Insight key={i} {...ins} />)}
        </div>
      </Section>

      {/* ── 3. LIFESTYLE INFLATION KILL SWITCH ─────────────────── */}
      <Section icon="🔪" title="Lifestyle Inflation Kill Switch" color="from-orange-500 to-amber-600">
        <div className="py-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Top Expense Categories</p>
          {(is?.expenseAccounts || [])
            .filter(a => a.displayAmount > 0)
            .sort((a, b) => b.displayAmount - a.displayAmount)
            .slice(0, 8)
            .map(e => {
              const share = pct(e.displayAmount, totalExpenses);
              return (
                <div key={e._id} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700">{e.accountTitle}</span>
                    <div className="text-right">
                      <span className="font-mono text-sm font-semibold text-gray-800">{formatCurrency(e.displayAmount)}</span>
                      <span className="text-xs text-gray-400 ml-2">{share.toFixed(1)}%</span>
                    </div>
                  </div>
                  <Bar
                    pctVal={share}
                    color={share > 25 ? 'bg-expense' : share > 15 ? 'bg-yellow-400' : 'bg-primary-400'}
                    max={40}
                  />
                </div>
              );
            })}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-surface-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">If you cut 10% of expenses</p>
              <p className="font-mono font-bold text-income text-base">{formatCurrency(totalExpenses * 0.10 / 12)}</p>
              <p className="text-xs text-gray-500">extra per month</p>
            </div>
            <div className="bg-surface-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">If you cut 20% of expenses</p>
              <p className="font-mono font-bold text-income text-base">{formatCurrency(totalExpenses * 0.20 / 12)}</p>
              <p className="text-xs text-gray-500">extra per month</p>
            </div>
          </div>
        </div>
        <div className="pb-1 space-y-2">
          {insights.lifestyle.map((ins, i) => <Insight key={i} {...ins} />)}
          <Insight type="action" text={`50/30/20 target: Needs ≤${formatCurrency(monthlyIncome * 0.5)}/mo · Wants ≤${formatCurrency(monthlyIncome * 0.3)}/mo · Savings ≥${formatCurrency(monthlyIncome * 0.2)}/mo`} />
        </div>
      </Section>

      {/* ── 4. NET WORTH & WEALTH VISUALIZER ───────────────────── */}
      <Section icon="💎" title="Net Worth & Wealth Visualizer" color="from-violet-600 to-purple-700">
        <div className="py-3 space-y-3">
          {/* Asset breakdown */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Asset Composition</p>
          {[
            { label: 'Current Assets', val: currentAssets,    color: 'bg-blue-400' },
            { label: 'Investments',    val: totalInvestments, color: 'bg-indigo-400' },
            { label: 'Fixed Assets',   val: fixedAssets,      color: 'bg-violet-400' },
          ].map(r => {
            const share = pct(r.val, totalAssets);
            return (
              <div key={r.label} className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0 text-xs text-gray-600">{r.label}</div>
                <div className="flex-1"><Bar pctVal={share} color={r.color} /></div>
                <div className="w-32 text-right flex-shrink-0">
                  <span className="font-mono text-xs font-semibold">{formatCurrency(r.val)}</span>
                  <span className="text-xs text-gray-400 ml-1">{share.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}

          {/* Net worth breakdown */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Total Assets</p>
              <p className="font-mono font-bold text-primary-700 text-sm">{formatCurrency(totalAssets)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Total Liabilities</p>
              <p className="font-mono font-bold text-expense text-sm">{formatCurrency(totalLiab)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Net Worth</p>
              <p className={`font-mono font-bold text-sm ${totalEquity >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(totalEquity)}</p>
            </div>
          </div>

          {/* Key ratios */}
          <div className="space-y-2">
            <MetricRow
              label="Asset-to-Equity Ratio"
              value={totalEquity > 0 ? (totalAssets / totalEquity).toFixed(2) + 'x' : 'N/A'}
              status={totalEquity > 0 && totalAssets / totalEquity <= 3 ? 'green' : 'yellow'}
              benchmark="1–3× ideal range"
            />
            <MetricRow
              label="Return on Assets (Net Income / Assets)"
              value={`${returnOnAssets.toFixed(1)}%`}
              status={score(returnOnAssets, { good: 5, fair: 2 })}
              benchmark="≥5% Good · ≥2% Fair"
            />
            <MetricRow
              label="Net Worth / Annual Income"
              value={`${netWorthToIncome.toFixed(2)}×`}
              status={score(netWorthToIncome, { good: 1, fair: 0.5 })}
              benchmark="≥1× Good · ≥0.5× Fair"
            />
          </div>
        </div>
        <div className="pb-1 space-y-2">
          {insights.wealth.map((ins, i) => <Insight key={i} {...ins} />)}
        </div>
      </Section>

      {/* ── 5. MONEY MINDSET (pattern analysis) ─────────────────── */}
      <Section icon="🧠" title="Money Mindset & Pattern Analysis" color="from-pink-500 to-rose-600">
        <div className="py-3 space-y-3">
          {/* Income diversification */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Income Sources</p>
            {(is?.revenueAccounts || []).filter(a => a.displayAmount > 0).map(a => (
              <div key={a._id} className="flex justify-between py-1.5 border-b border-surface-50">
                <span className="text-sm text-gray-700">{a.accountTitle}</span>
                <div className="text-right">
                  <span className="font-mono text-sm font-semibold text-income">{formatCurrency(a.displayAmount)}</span>
                  <span className="text-xs text-gray-400 ml-1">{pct(a.displayAmount, totalRevenue).toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {(is?.revenueAccounts || []).filter(a => a.displayAmount > 0).length <= 1 && (
              <Insight type="warning" text="You rely on a single income source. True financial security comes from 2+ income streams. Consider freelancing, investments, or rental income." />
            )}
            {(is?.revenueAccounts || []).filter(a => a.displayAmount > 0).length >= 3 && (
              <Insight type="good" text={`You have ${(is?.revenueAccounts || []).filter(a => a.displayAmount > 0).length} income sources — excellent diversification that protects against income shocks.`} />
            )}
          </div>

          {/* Spending pattern archetype */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Spending Archetype</p>
            {(() => {
              const type = savingsRatePct >= 25 ? { name: '🏦 The Builder', desc: 'You consistently save and invest. You prioritize future security over present gratification.' }
                : savingsRatePct >= 10  ? { name: '⚖️ The Balancer', desc: 'You balance spending and saving. Small improvements in savings rate will compound significantly.' }
                : savingsRatePct >= 0   ? { name: '💸 The Liver', desc: 'You spend most of what you earn. Life is enjoyed now, but future-you needs more attention.' }
                :                         { name: '🔥 The Overspender', desc: 'Spending exceeds income. Immediate action required to prevent debt spiral.' };
              return (
                <div className="bg-surface-50 rounded-xl p-4">
                  <p className="font-bold text-gray-900 mb-1">{type.name}</p>
                  <p className="text-sm text-gray-600">{type.desc}</p>
                </div>
              );
            })()}
          </div>

          {/* Key mindset metrics */}
          <Insight type="action" text={`Your money personality strength: Turn it into a superpower. If you're a Builder — continue compounding. If a Balancer — find one area to optimize. If a Liver — automate savings before spending.`} />
        </div>
      </Section>

      {/* ── 6. WEEKLY MONEY CHECK-IN ────────────────────────────── */}
      <Section icon="📅" title="Weekly Money Check-In" color="from-teal-500 to-emerald-600">
        <div className="py-3 space-y-3">
          {/* Weekly budget breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Weekly Income',   val: formatCurrency(weeklyIncome),   color: 'text-income' },
              { label: 'Weekly Expenses', val: formatCurrency(weeklyBudget),   color: 'text-expense' },
              { label: 'Weekly Savings',  val: formatCurrency(weeklySaving),   color: weeklySaving >= 0 ? 'text-primary-700' : 'text-expense' },
            ].map(s => (
              <div key={s.label} className="bg-surface-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`font-mono font-bold text-sm ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>

          {/* This week's missions */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">This Week's Money Missions</p>
            {[
              savingsRatePct < 20
                ? `💰 SAVINGS: Transfer ${formatCurrency(Math.max(0, totalRevenue * 0.20 / 52 - weeklySaving))} to savings this week to hit 20% savings rate`
                : `💰 SAVINGS: Great savings rate! Consider investing ${formatCurrency(weeklySaving * 0.5)} of this week's surplus`,
              debtRatioPct > 40
                ? `🚀 DEBT: Pay ${formatCurrency(Math.min(totalLiab * 0.01, monthlySurplus * 0.5))} extra on your highest-interest debt this week`
                : `🚀 DEBT: Debt is under control. Use surplus to build investments instead`,
              cashBuffer < 3
                ? `🛡 EMERGENCY FUND: Add ${formatCurrency(monthlyExpenses * 0.25)} to your cash reserve this week`
                : `📈 INVEST: Review your investment accounts and confirm they're growing`,
            ].map((mission, i) => (
              <div key={i} className="flex gap-2.5 p-3 bg-surface-50 rounded-lg mb-2">
                <span className="w-5 h-5 bg-teal-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold">{i+1}</span>
                <p className="text-xs md:text-sm text-gray-700 leading-relaxed">{mission}</p>
              </div>
            ))}
          </div>

          {/* Quick win */}
          <Insight type="action" text={`Quick Win (10 minutes): Review last week's transactions and categorize any uncategorized ones. Awareness is the first step to control.`} />
        </div>
      </Section>

      {/* ── 7. INVESTMENT STRATEGY BUILDER ──────────────────────── */}
      <Section icon="📈" title="Investment Strategy Builder" color="from-indigo-600 to-blue-700">
        <div className="py-3 space-y-4">
          {/* Investment readiness checklist */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Investment Readiness Checklist</p>
            {[
              { label: `Emergency Fund (${cashBuffer.toFixed(1)} months)`, done: cashBuffer >= 3 },
              { label: `Positive Monthly Cash Flow (${formatCurrency(monthlySurplus)}/mo)`, done: monthlySurplus > 0 },
              { label: `Debt Ratio Under 60% (${debtRatioPct.toFixed(1)}%)`, done: debtRatioPct < 60 },
              { label: `Savings Rate ≥10% (${savingsRatePct.toFixed(1)}%)`, done: savingsRatePct >= 10 },
              { label: `Has Investment Accounts (${formatCurrency(totalInvestments)})`, done: totalInvestments > 0 },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 border-b border-surface-50">
                <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                  ${c.done ? 'bg-income text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {c.done ? '✓' : '○'}
                </span>
                <span className={`text-sm ${c.done ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* Allocation recommendation */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recommended Monthly Allocation</p>
            {(() => {
              const surplus = Math.max(0, monthlySurplus);
              const allocs = [
                { label: 'Emergency Top-up',  pct: cashBuffer < 3 ? 30 : 0,  color: 'bg-yellow-400' },
                { label: 'Debt Acceleration', pct: debtRatioPct > 60 ? 30 : debtRatioPct > 40 ? 20 : 0, color: 'bg-red-400' },
                { label: 'Sanchayapatra',     pct: 25, color: 'bg-green-500' },
                { label: 'DPS / FD',          pct: 20, color: 'bg-blue-400'  },
                { label: 'Stocks / Equity',   pct: 15, color: 'bg-indigo-400'},
                { label: 'Liquid Reserve',    pct: 10, color: 'bg-gray-300'  },
              ].filter(a => a.pct > 0);
              const totalPct = allocs.reduce((s, a) => s + a.pct, 0);
              return allocs.map(a => {
                const normalized = (a.pct / totalPct) * 100;
                const amount = surplus * (a.pct / totalPct);
                return (
                  <div key={a.label} className="flex items-center gap-3 mb-2">
                    <div className="w-28 flex-shrink-0 text-xs text-gray-600">{a.label}</div>
                    <div className="flex-1"><Bar pctVal={normalized} color={a.color} /></div>
                    <div className="w-24 text-right flex-shrink-0">
                      <span className="font-mono text-xs font-semibold">{formatCurrency(amount)}</span>
                      <span className="text-xs text-gray-400 ml-1">{normalized.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* 5-year projection */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">5-Year Projection (8% annual return)</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '1 Year',  val: inv1yr  },
                { label: '3 Years', val: inv3yr  },
                { label: '5 Years', val: inv5yr  },
              ].map(p => (
                <div key={p.label} className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">{p.label}</p>
                  <p className="font-mono font-bold text-indigo-700 text-sm">{formatCurrency(p.val)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pb-1 space-y-2">
            {insights.investment.map((ins, i) => <Insight key={i} {...ins} />)}
          </div>
        </div>
        <div className="pb-3">
          <p className="text-xs text-gray-400 text-center">
            📊 All projections are estimates based on historical averages. Past performance does not guarantee future results.
            Consult a licensed financial advisor for major decisions.
          </p>
        </div>
      </Section>
    </div>
  );
}
