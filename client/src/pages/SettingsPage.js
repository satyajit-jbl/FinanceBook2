import { useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { dbUser, isLocal } = useAuth();
  const [pwForm, setPwForm]   = useState({ current: '', newPw: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [pwLoading, setPwLoading] = useState(false);

  const setF = (k, v) => { setPwForm(f => ({ ...f, [k]: v })); setPwErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!pwForm.current)              e.current = 'Current password is required';
    if (!pwForm.newPw)                e.newPw   = 'New password is required';
    else if (pwForm.newPw.length < 8) e.newPw   = 'At least 8 characters required';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwForm.newPw))
                                      e.newPw   = 'Must include uppercase, lowercase and a number';
    if (!pwForm.confirm)              e.confirm = 'Please confirm your new password';
    else if (pwForm.newPw !== pwForm.confirm) e.confirm = 'Passwords do not match';
    if (pwForm.current && pwForm.newPw && pwForm.current === pwForm.newPw)
                                      e.newPw   = 'New password must be different from current';
    setPwErrors(e);
    return !Object.keys(e).length;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.current,
        newPassword:     pwForm.newPw,
      });
      toast.success('Password changed successfully!');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setPwErrors({});
    } catch (err) {
      if (err.status === 401) {
        setPwErrors({ current: 'Current password is incorrect.' });
      } else if (err.status === 400) {
        setPwErrors({ newPw: err.message });
      } else {
        toast.error(err.message || 'Failed to change password');
      }
    } finally { setPwLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage your account preferences</p>
      </div>

      {/* Profile info */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-800 mb-4">Profile Information</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-700 font-bold text-2xl">
            {dbUser?.displayName?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{dbUser?.displayName}</p>
            <p className="text-gray-400 text-sm">{dbUser?.email}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span className={`badge ${dbUser?.role === 'admin' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                {dbUser?.role === 'admin' ? '⚙ Admin' : '👤 User'}
              </span>
              <span className={`badge ${dbUser?.isApproved ? 'bg-income-light text-income' : 'bg-warning-light text-warning'}`}>
                {dbUser?.isApproved ? '✓ Approved' : '⏳ Pending'}
              </span>
              <span className="badge bg-surface-100 text-gray-500">
                {dbUser?.provider === 'google' ? '🔵 Google' : '📧 Email/Password'}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Authentication</p>
            <p className="font-medium text-gray-700">
              {dbUser?.provider === 'google' ? '🔵 Google Account' : '📧 Email & Password'}
            </p>
          </div>
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Account Status</p>
            <p className="font-medium text-gray-700">{dbUser?.isActive ? '🟢 Active' : '🔴 Inactive'}</p>
          </div>
        </div>
      </div>

      {/* Change Password — local users only */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-800 mb-2">Change Password</h2>

        {!isLocal ? (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <p className="font-semibold mb-1">🔵 Google Account</p>
            <p>You're signed in with Google. Password management is handled through your Google account settings at <a href="https://myaccount.google.com" target="_blank" rel="noreferrer" className="underline">myaccount.google.com</a>.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Choose a strong password — at least 8 characters with uppercase, lowercase, and a number.
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
              <div>
                <label className="label">Current Password</label>
                <input type="password" className={`input ${pwErrors.current ? 'input-error' : ''}`}
                  placeholder="Enter current password" value={pwForm.current}
                  onChange={e => setF('current', e.target.value)}
                  autoComplete="current-password" disabled={pwLoading} />
                {pwErrors.current && <p className="text-red-500 text-xs mt-1">{pwErrors.current}</p>}
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className={`input ${pwErrors.newPw ? 'input-error' : ''}`}
                  placeholder="New password (min 8 characters)" value={pwForm.newPw}
                  onChange={e => setF('newPw', e.target.value)}
                  autoComplete="new-password" disabled={pwLoading} />
                {pwErrors.newPw && <p className="text-red-500 text-xs mt-1">{pwErrors.newPw}</p>}
                {pwForm.newPw && (
                  <div className="flex gap-1 mt-1.5">
                    {['length','upper','lower','number'].map(c => {
                      const ok = { length: pwForm.newPw.length >= 8, upper: /[A-Z]/.test(pwForm.newPw), lower: /[a-z]/.test(pwForm.newPw), number: /\d/.test(pwForm.newPw) }[c];
                      return <div key={c} className={`h-1 flex-1 rounded-full transition-colors ${ok ? 'bg-income' : 'bg-gray-200'}`} />;
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className={`input ${pwErrors.confirm ? 'input-error' : ''}`}
                  placeholder="Repeat new password" value={pwForm.confirm}
                  onChange={e => setF('confirm', e.target.value)}
                  autoComplete="new-password" disabled={pwLoading} />
                {pwErrors.confirm && <p className="text-red-500 text-xs mt-1">{pwErrors.confirm}</p>}
                {pwForm.confirm && pwForm.newPw === pwForm.confirm && (
                  <p className="text-income text-xs mt-1">✓ Passwords match</p>
                )}
              </div>
              <button type="submit" className="btn-primary" disabled={pwLoading}>
                {pwLoading ? 'Changing…' : '🔒 Change Password'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* App info */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-800 mb-3">About FinanceBook</h2>
        <div className="space-y-2 text-sm text-gray-500">
          <p>📊 <strong className="text-gray-700">Accounting:</strong> Double-Entry (GAAP Compliant)</p>
          <p>💰 <strong className="text-gray-700">Currency:</strong> Bangladeshi Taka (BDT ৳)</p>
          <p>🔐 <strong className="text-gray-700">Authentication:</strong> Email/Password + Google OAuth</p>
          <p>🍪 <strong className="text-gray-700">Sessions:</strong> httpOnly Cookie (JWT) for email users</p>
        </div>
      </div>
    </div>
  );
}
