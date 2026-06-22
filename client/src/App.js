import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import NewTransactionPage from './pages/NewTransactionPage';
import AccountsPage from './pages/AccountsPage';
import LedgerPage from './pages/LedgerPage';
import TrialBalancePage from './pages/reports/TrialBalancePage';
import IncomeStatementPage from './pages/reports/IncomeStatementPage';
import BalanceSheetPage from './pages/reports/BalanceSheetPage';
import CashFlowPage from './pages/reports/CashFlowPage';
import AuditTrailPage from './pages/reports/AuditTrailPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import AdvisorPage from './pages/advisor/AdvisorPage';
import BudgetPage from './pages/budget/BudgetPage';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Route guard: redirect to dashboard if already logged in & approved
function PublicRoute({ children }) {
  const { dbUser, loading, isApproved } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  if (dbUser && isApproved) return <Navigate to="/dashboard" replace />;
  return children;
}

// Route guard: require login, approved, and optionally admin
function ProtectedRoute({ children, adminOnly = false }) {
  const { dbUser, firebaseUser, loading, isApproved, isAdmin, authMode } = useAuth();

  if (loading) return <LoadingSpinner fullScreen />;

  // Not authenticated at all
  const hasAuth = firebaseUser || authMode === 'local';
  if (!hasAuth && authMode === 'none') return <Navigate to="/login" replace />;
  if (loading) return <LoadingSpinner fullScreen />;

  // Has Firebase/local session but no DB user yet
  if (!dbUser) return <Navigate to="/register" replace />;

  // Has DB user but not yet approved
  if (!isApproved) return <Navigate to="/pending" replace />;

  // Admin-only page
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/pending"  element={<PendingApprovalPage />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<DashboardPage />} />
        <Route path="transactions"      element={<TransactionsPage />} />
        <Route path="transactions/new"  element={<NewTransactionPage />} />
        <Route path="transactions/:id/edit" element={<NewTransactionPage />} />
        <Route path="accounts"          element={<AccountsPage />} />
        <Route path="accounts/:id/ledger" element={<LedgerPage />} />
        <Route path="reports/trial-balance"    element={<TrialBalancePage />} />
        <Route path="reports/income-statement" element={<IncomeStatementPage />} />
        <Route path="reports/balance-sheet"    element={<BalanceSheetPage />} />
        <Route path="reports/cash-flow"        element={<CashFlowPage />} />
        <Route path="reports/audit-trail"      element={<AuditTrailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="advisor" element={<AdvisorPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="admin"    element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '14px', maxWidth: '420px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' }, duration: 5000 },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
