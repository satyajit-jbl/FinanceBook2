import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

/* ── Navigation definition ── */
const NAV_MAIN = [
  { to: '/dashboard',    icon: '⊞',  label: 'Dashboard',     mobileIcon: '⊞' },
  { to: '/transactions', icon: '⇄',  label: 'Transactions',  mobileIcon: '⇄' },
  { to: '/accounts',     icon: '◫',  label: 'Accounts',      mobileIcon: '◫' },
  { to: '/budget',       icon: '📋', label: 'Budget Planner', mobileIcon: '📋' },
];
const NAV_REPORTS = [
  { to: '/reports/trial-balance',    icon: '≡', label: 'Trial Balance'    },
  { to: '/reports/income-statement', icon: '◈', label: 'Income Statement' },
  { to: '/reports/balance-sheet',    icon: '◉', label: 'Balance Sheet'    },
  { to: '/reports/cash-flow',        icon: '↻', label: 'Cash Flow'        },
];
const NAV_ADVISOR = [
  { to: '/advisor', icon: '🤖', label: 'AI Advisor' },
];

export default function Layout() {
  const { dbUser, logout, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [sideOpen, setSideOpen] = useState(false);


  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch {
      toast.error('Logout failed');
    }
  };

  /* ── Sidebar inner content (shared desktop + mobile) ── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">৳</div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">FinanceBook</p>
            <p className="text-xs text-gray-400 hidden xl:block">Double-Entry System</p>
          </div>
        </div>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {/* Main nav */}
        {NAV_MAIN.map(item => (
          <NavLink key={item.to} to={item.to} onClick={() => setSideOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}

        {/* AI Advisor */}
        {NAV_ADVISOR.map(item => (
          <NavLink key={item.to} to={item.to} onClick={() => setSideOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}

        {/* Reports */}
        <p className="text-xs font-bold text-gray-300 uppercase tracking-widest px-3 pt-4 pb-1">Reports</p>
        {NAV_REPORTS.map(item => (
          <NavLink key={item.to} to={item.to} onClick={() => setSideOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}

        {/* Admin */}
        {isAdmin && (
          <>
            <p className="text-xs font-bold text-gray-300 uppercase tracking-widest px-3 pt-4 pb-1">Admin</p>
            <NavLink to="/admin" onClick={() => setSideOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <span className="text-base w-5 text-center flex-shrink-0">⚙</span>
              <span className="truncate">User Management</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-gray-100 space-y-1.5">
        {/* Quick new transaction */}
        <NavLink to="/transactions/new"
          className="nav-link bg-primary-600 text-white hover:bg-primary-700 hover:text-white justify-center font-semibold">
          <span className="text-lg leading-none">+</span>
          <span>New Transaction</span>
        </NavLink>

        {/* Settings */}
        <NavLink to="/settings" onClick={() => setSideOpen(false)}
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="text-base w-5 text-center flex-shrink-0">⚙</span>
          <span>Settings</span>
        </NavLink>

        {/* User info row + small round logout button */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
            {dbUser?.displayName?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">{dbUser?.displayName}</p>
            <p className="text-xs text-gray-400 truncate">{dbUser?.email}</p>
          </div>
          {/* Small round red logout button */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700
                       flex items-center justify-center transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Which section is active for mobile bottom nav ── */
  const isPath = (p) => location.pathname.startsWith(p);

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">

      {/* ── DESKTOP SIDEBAR (lg+) ── */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-white border-r border-gray-100 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── MOBILE DRAWER OVERLAY (< lg) ── */}
      {sideOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSideOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] h-full bg-white flex flex-col shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0 shadow-sm">
          <button onClick={() => setSideOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">৳</div>
            <p className="font-bold text-gray-900 text-sm">FinanceBook</p>
          </div>

          <NavLink to="/transactions/new"
            className="flex items-center gap-1 bg-primary-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary-700">
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New</span>
          </NavLink>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>

        {/* ── MOBILE BOTTOM NAV (< lg) ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-30 flex items-center justify-around px-2 py-1 safe-area-pb">
          <NavLink to="/dashboard" className={({ isActive }) => `mob-nav ${isActive ? 'mob-nav-active' : ''}`}>
            <span className="text-lg">⊞</span>
            <span>Home</span>
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => `mob-nav ${isActive ? 'mob-nav-active' : ''}`}>
            <span className="text-lg">⇄</span>
            <span>Transactions</span>
          </NavLink>
          <NavLink to="/transactions/new"
            className="flex flex-col items-center -mt-5">
            <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg border-4 border-white">
              +
            </div>
            <span className="text-xs text-primary-600 font-semibold mt-0.5">New</span>
          </NavLink>
          <NavLink to="/budget" className={({ isActive }) => `mob-nav ${isActive ? 'mob-nav-active' : ''}`}>
            <span className="text-lg">📋</span>
            <span>Budget</span>
          </NavLink>
          <NavLink to="/accounts" className={({ isActive }) => `mob-nav ${isActive ? 'mob-nav-active' : ''}`}>
            <span className="text-lg">◫</span>
            <span>Accounts</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
