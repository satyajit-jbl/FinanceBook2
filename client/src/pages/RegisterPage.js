import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate         = useNavigate();
  const { setLocalUser, firebaseUser, dbUser, isApproved } = useAuth();
  const [form, setForm]  = useState({ email: '', password: '', confirm: '', displayName: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  // 'form' | 'complete-google' — step when registering via Google
  const [step, setStep]  = useState('form');

  // If already logged in and approved, redirect to dashboard
  useEffect(() => {
    if (dbUser && isApproved) {
      navigate('/dashboard', { replace: true });
    }
  }, [dbUser, isApproved, navigate]);

  // If Firebase user exists but no DB user, show name completion step
  useEffect(() => {
    if (firebaseUser && !dbUser) {
      setStep('complete-google');
      setForm(f => ({ ...f, displayName: firebaseUser.displayName || '' }));
    }
  }, [firebaseUser, dbUser]);

  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '', general: '' })); };

  // ── Validate local registration form ───────────────────────────
  const validate = () => {
    const e = {};
    if (!form.displayName.trim() || form.displayName.trim().length < 2)
      e.displayName = 'Full name must be at least 2 characters';
    if (!form.email.trim())
      e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email))
      e.email = 'Invalid email address';
    if (!form.password)
      e.password = 'Password is required';
    else if (form.password.length < 8)
      e.password = 'At least 8 characters required';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
      e.password = 'Must include uppercase, lowercase and a number';
    if (form.password !== form.confirm)
      e.confirm = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  // ── Local email/password registration ──────────────────────────
  const handleLocalRegister = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/local/register', {
        email:       form.email.trim(),
        password:    form.password,
        displayName: form.displayName.trim(),
      });
      setLocalUser(data.user);
      if (data.user.isApproved) {
        toast.success('Account created! Welcome.');
        navigate('/dashboard');
      } else {
        toast.success('Account created! Waiting for admin approval.');
        navigate('/pending');
      }
    } catch (err) {
      setErrors({ general: err.message || 'Registration failed. Please try again.' });
    } finally { setLoading(false); }
  };

  // ── Google registration ─────────────────────────────────────────
  const handleGoogle = async () => {
    setGLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Sync with DB
      const { data } = await api.post('/auth/google/sync', {
        displayName: result.user.displayName || result.user.email,
      });
      if (data.user.isApproved) {
        toast.success(`Welcome, ${data.user.displayName}!`);
        navigate('/dashboard');
      } else {
        toast.success('Account created! Waiting for admin approval.');
        navigate('/pending');
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-up failed. Please try again.');
      }
    } finally { setGLoading(false); }
  };

  // ── Complete Google registration (name step) ────────────────────
  const handleCompleteGoogle = async (e) => {
    e.preventDefault();
    if (!form.displayName.trim() || form.displayName.trim().length < 2) {
      setErrors({ displayName: 'Full name must be at least 2 characters' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google/sync', {
        displayName: form.displayName.trim(),
      });
      if (data.user.isApproved) {
        toast.success(`Welcome, ${data.user.displayName}!`);
        navigate('/dashboard');
      } else {
        toast.success('Account created! Waiting for admin approval.');
        navigate('/pending');
      }
    } catch (err) {
      setErrors({ general: err.message || 'Failed to complete registration.' });
    } finally { setLoading(false); }
  };

  // ── Google completion step ──────────────────────────────────────
  if (step === 'complete-google' && firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-surface-100 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg mx-auto mb-4">৳</div>
            <h1 className="text-2xl font-bold text-gray-900">Complete Registration</h1>
            <p className="text-gray-400 text-sm mt-1">{firebaseUser.email}</p>
          </div>
          <div className="card p-8">
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.general}</div>
            )}
            <form onSubmit={handleCompleteGoogle} className="space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className={`input ${errors.displayName ? 'input-error' : ''}`}
                  placeholder="Your full name" value={form.displayName}
                  onChange={e => setF('displayName', e.target.value)}
                  disabled={loading} autoFocus />
                {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
                {loading ? 'Creating Account…' : 'Complete Registration'}
              </button>
            </form>
            <p className="text-xs text-gray-400 text-center mt-4">
              Your account will be reviewed by an administrator before you can access the system.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main registration form ──────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-surface-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg mx-auto mb-4">৳</div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-400 text-sm mt-1">Join FinanceBook</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-5">Register</h2>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.general}</div>
          )}

          {/* Email/password form */}
          <form onSubmit={handleLocalRegister} className="space-y-4" noValidate>
            <div>
              <label className="label">Full Name *</label>
              <input className={`input ${errors.displayName ? 'input-error' : ''}`}
                placeholder="Your full name" value={form.displayName}
                onChange={e => setF('displayName', e.target.value)}
                disabled={loading || gLoading} autoFocus />
              {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
            </div>
            <div>
              <label className="label">Email Address *</label>
              <input type="email" className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com" value={form.email}
                onChange={e => setF('email', e.target.value)}
                disabled={loading || gLoading} autoComplete="email" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="label">Password *</label>
              <input type="password" className={`input ${errors.password ? 'input-error' : ''}`}
                placeholder="Min 8 chars, upper+lower+number" value={form.password}
                onChange={e => setF('password', e.target.value)}
                disabled={loading || gLoading} autoComplete="new-password" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              {/* Strength bar */}
              {form.password && (
                <div className="flex gap-1 mt-1.5">
                  {['length','upper','lower','number'].map(c => {
                    const ok = { length: form.password.length >= 8, upper: /[A-Z]/.test(form.password), lower: /[a-z]/.test(form.password), number: /\d/.test(form.password) }[c];
                    return <div key={c} className={`h-1 flex-1 rounded-full transition-colors ${ok ? 'bg-income' : 'bg-gray-200'}`} />;
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="label">Confirm Password *</label>
              <input type="password" className={`input ${errors.confirm ? 'input-error' : ''}`}
                placeholder="Repeat password" value={form.confirm}
                onChange={e => setF('confirm', e.target.value)}
                disabled={loading || gLoading} autoComplete="new-password" />
              {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm}</p>}
              {form.confirm && form.password === form.confirm && <p className="text-income text-xs mt-1">✓ Passwords match</p>}
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-2.5"
              disabled={loading || gLoading}>
              {loading ? 'Creating Account…' : 'Create Account'}
            </button>
          </form>

          {/* Google registration */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="px-3 bg-white text-xs text-gray-400">or sign up with</span></div>
          </div>
          <button onClick={handleGoogle} disabled={loading || gLoading}
            className="btn btn-secondary w-full justify-center py-2.5 gap-3">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {gLoading ? 'Signing up…' : 'Sign up with Google'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">Sign in</Link>
          </p>
          <p className="text-xs text-gray-300 text-center mt-2">
            Your account requires admin approval before access is granted.
          </p>
        </div>
      </div>
    </div>
  );
}
