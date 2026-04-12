import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const FIREBASE_ERRORS = {
  'auth/user-not-found':    'Invalid email or password.',
  'auth/wrong-password':    'Invalid email or password.',
  'auth/invalid-credential':'Invalid email or password.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later or reset your password.',
  'auth/user-disabled':     'This account has been disabled.',
};

export default function LoginPage() {
  const navigate            = useNavigate();
  const { setLocalUser }    = useAuth();
  const [tab, setTab]       = useState('local'); // 'local' | 'google' | 'reset'
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [errors, setErrors]     = useState({});

  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '', general: '' })); };

  // ── Validate ────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.email.trim())                     e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email    = 'Invalid email address';
    if (tab === 'local' && !form.password)      e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  // ── Local email/password login ──────────────────────────────────
  const handleLocalLogin = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/local/login', {
        email: form.email.trim(),
        password: form.password,
      });
      setLocalUser(data.user);

      if (!data.user.isApproved) { navigate('/pending'); return; }
      toast.success(`Welcome back, ${data.user.displayName}!`);
      navigate('/dashboard');
    } catch (err) {
      setErrors({ general: err.message || 'Login failed. Please try again.' });
    } finally { setLoading(false); }
  };

  // ── Google login ────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const { data } = await api.post('/auth/google/sync', {
        displayName: result.user.displayName || result.user.email,
      });
      if (!data.user.isApproved) { navigate('/pending'); return; }
      toast.success(`Welcome, ${data.user.displayName}!`);
      navigate('/dashboard');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-in failed. Please try again.');
      }
    } finally { setGLoading(false); }
  };

  // ── Password reset ──────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) { setErrors({ email: 'Enter your email to reset password' }); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setErrors({ email: 'Invalid email address' }); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, form.email.trim());
      toast.success('Password reset email sent! Check your inbox.');
      setTab('local');
    } catch (err) {
      setErrors({ general: err.code === 'auth/user-not-found' ? 'No account found with this email.' : 'Failed to send reset email.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-surface-100 p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg mx-auto mb-4">৳</div>
          <h1 className="text-2xl font-bold text-gray-900">FinanceBook</h1>
          <p className="text-gray-400 text-sm mt-1">Personal Finance Tracker</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-5">
            {tab === 'reset' ? 'Reset Password' : 'Sign In'}
          </h2>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.general}
            </div>
          )}

          {/* ── Email / Password form ── */}
          {tab !== 'reset' && (
            <form onSubmit={handleLocalLogin} className="space-y-4" noValidate>
              <div>
                <label className="label">Email Address</label>
                <input type="email" className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="you@example.com" value={form.email}
                  onChange={e => setF('email', e.target.value)}
                  autoComplete="email" disabled={loading || gLoading} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className={`input ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••" value={form.password}
                  onChange={e => setF('password', e.target.value)}
                  autoComplete="current-password" disabled={loading || gLoading} />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-2.5"
                disabled={loading || gLoading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── Password Reset form ── */}
          {tab === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4" noValidate>
              <div>
                <label className="label">Email Address</label>
                <input type="email" className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="you@example.com" value={form.email}
                  onChange={e => setF('email', e.target.value)}
                  autoComplete="email" disabled={loading} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Email'}
              </button>
            </form>
          )}

          {/* ── Google button ── */}
          {tab !== 'reset' && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center"><span className="px-3 bg-white text-xs text-gray-400">or continue with</span></div>
              </div>
              <button onClick={handleGoogle} disabled={loading || gLoading}
                className="btn btn-secondary w-full justify-center py-2.5 gap-3">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {gLoading ? 'Signing in…' : 'Continue with Google'}
              </button>
            </>
          )}

          {/* ── Footer links ── */}
          <div className="mt-5 space-y-2 text-center">
            {tab === 'reset' ? (
              <button onClick={() => { setTab('local'); setErrors({}); }}
                className="text-xs text-primary-600 hover:underline">← Back to Sign In</button>
            ) : (
              <button onClick={() => { setTab('reset'); setErrors({}); }}
                className="text-xs text-primary-600 hover:underline">Forgot password?</button>
            )}
            <p className="text-xs text-gray-500">
              New user?{' '}
              <Link to="/register" className="text-primary-600 hover:underline font-medium">Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
