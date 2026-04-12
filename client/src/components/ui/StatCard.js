export default function StatCard({ title, value, sub, icon, color = 'blue', trend }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className={`text-2xl p-2 rounded-lg ${colors[color]}`}>{icon}</span>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'text-income bg-income-light' : 'text-expense bg-expense-light'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5 leading-tight">{title}</p>
      <p className="text-base md:text-xl font-bold text-gray-900 font-mono leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
