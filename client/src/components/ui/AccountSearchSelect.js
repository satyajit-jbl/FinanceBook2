import { useState, useRef, useEffect } from 'react';

/**
 * Searchable account selector — replaces plain <select> for account pickers.
 * Props:
 *   accounts    — array of account objects
 *   value       — selected accountId (string)
 *   onChange    — (id, account) => void
 *   placeholder — string
 *   filter      — optional fn(account) => bool to pre-filter the list
 *   error       — boolean
 */
export default function AccountSearchSelect({ accounts = [], value, onChange, placeholder = 'Search account…', filter, error }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const filtered = (filter ? accounts.filter(filter) : accounts).filter(a => {
    if (!query) return true;
    const q = query.toLowerCase();
    return a.accountTitle.toLowerCase().includes(q) ||
           (a.accountNo || '').toLowerCase().includes(q) ||
           (a.accountType || '').toLowerCase().includes(q);
  });

  const selected = accounts.find(a => a._id === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (acc) => {
    onChange(acc._id, acc);
    setOpen(false);
    setQuery('');
  };

  const handleOpen = () => {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Group filtered accounts by subAccount for display
  const grouped = filtered.reduce((g, a) => {
    const k = a.subAccount || 'Other';
    if (!g[k]) g[k] = [];
    g[k].push(a);
    return g;
  }, {});

  const subColors = {
    'Current Assets': 'text-blue-600', 'Investments': 'text-indigo-600',
    'Fixed Assets': 'text-violet-600', 'Current Liabilities': 'text-red-500',
    'Short-term Liabilities': 'text-orange-500', 'Long-term Liabilities': 'text-rose-600',
    'Equity': 'text-green-600', 'Revenue': 'text-emerald-600', 'Expenses': 'text-red-500',
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — shows selected account or placeholder */}
      <button
        type="button"
        onClick={handleOpen}
        className={`input text-left flex items-center justify-between w-full
          ${error ? 'input-error' : ''}
          ${open ? 'ring-2 ring-primary-500 border-transparent' : ''}`}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${subColors[selected.subAccount] || 'text-gray-500'} bg-surface-100 shrink-0`}>
              {selected.subAccount?.split(' ')[0]}
            </span>
            <span className="truncate text-gray-800 font-medium">{selected.accountTitle}</span>
            {selected.accountNo && <span className="text-xs text-gray-400 shrink-0">#{selected.accountNo}</span>}
          </span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <svg className={`w-4 h-4 text-gray-400 ml-2 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-surface-200 shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-surface-100 bg-surface-50">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                className="input py-1.5 pl-8 text-sm"
                placeholder="Type account name or number…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No accounts match</div>
            ) : (
              Object.entries(grouped).map(([sub, accs]) => (
                <div key={sub}>
                  <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider bg-surface-50 border-b border-surface-100 ${subColors[sub] || 'text-gray-500'}`}>
                    {sub}
                  </div>
                  {accs.map(acc => (
                    <button
                      key={acc._id}
                      type="button"
                      onClick={() => handleSelect(acc)}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between
                        hover:bg-primary-50 transition-colors border-b border-surface-50
                        ${acc._id === value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-700'}`}
                    >
                      <span className="truncate">{acc.accountTitle}</span>
                      <span className="text-xs text-gray-400 ml-2 shrink-0 font-mono">
                        {acc.accountNo || acc.accountType}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer stats */}
          <div className="px-3 py-1.5 bg-surface-50 border-t border-surface-100 text-xs text-gray-400 text-right">
            {filtered.length} account{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
