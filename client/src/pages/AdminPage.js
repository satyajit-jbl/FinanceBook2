import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/format';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const StatusBadge = ({ user }) => {
  if (!user.isActive) return <span className="badge bg-gray-100 text-gray-500">🔴 Inactive</span>;
  if (!user.isApproved) return <span className="badge bg-warning-light text-warning">⏳ Pending</span>;
  return <span className="badge bg-income-light text-income">✓ Approved</span>;
};

export default function AdminPage() {
  const { dbUser: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [confirm, setConfirm] = useState(null); // { action, user, label, message }

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data.users);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action, uid) => {
    setActionLoading(uid + action);
    try {
      await api.post(`/admin/users/${uid}/${action}`);
      toast.success('User updated successfully');
      load();
    } catch (err) { toast.error(err.message || 'Action failed'); }
    finally { setActionLoading(null); setConfirm(null); }
  };

  const handleConfirm = () => {
    if (!confirm) return;
    doAction(confirm.action, confirm.user.uid);
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || u.displayName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'pending' && !u.isApproved && u.isActive) || (filter === 'approved' && u.isApproved) || (filter === 'inactive' && !u.isActive) || (filter === 'admin' && u.role === 'admin');
    return matchSearch && matchFilter;
  });

  const stats = {
    total: users.length,
    pending: users.filter(u => !u.isApproved && u.isActive).length,
    approved: users.filter(u => u.isApproved).length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-400 text-sm">{stats.total} total users</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', val: stats.total, icon: '👥', color: 'text-primary-700 bg-primary-50' },
          { label: 'Pending Approval', val: stats.pending, icon: '⏳', color: 'text-warning bg-warning-light' },
          { label: 'Approved', val: stats.approved, icon: '✓', color: 'text-income bg-income-light' },
          { label: 'Admins', val: stats.admins, icon: '⚙', color: 'text-purple-700 bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <span className={`text-xl p-2 rounded-lg ${s.color}`}>{s.icon}</span>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-xl font-bold text-gray-900">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending approvals alert */}
      {stats.pending > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">{stats.pending} user{stats.pending > 1 ? 's' : ''} awaiting approval</p>
            <p className="text-sm text-amber-600">Review and approve users below to grant access.</p>
          </div>
          <button onClick={() => setFilter('pending')} className="ml-auto btn btn-secondary btn-sm">View Pending</button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <input className="input w-56" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1 flex-wrap">
          {['all', 'pending', 'approved', 'inactive', 'admin'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-primary-600 text-white' : 'bg-surface-100 text-gray-600 hover:bg-surface-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">User</th>
              <th className="table-th hidden md:table-cell">Role</th>
              <th className="table-th">Status</th>
              <th className="table-th hidden lg:table-cell">Registered</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-gray-400 text-sm">No users found</td></tr>
            ) : filtered.map(user => {
              const isSelf = user.uid === currentUser?.uid;
              return (
                <tr key={user.uid} className={`border-b border-surface-50 hover:bg-surface-50 transition-colors ${isSelf ? 'bg-primary-50/50' : ''}`}>
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                        {user.displayName?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{user.displayName} {isSelf && <span className="text-xs text-primary-500">(you)</span>}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-td hidden md:table-cell">
                    <span className={`badge ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {user.role === 'admin' ? '⚙ Admin' : '👤 User'}
                    </span>
                  </td>
                  <td className="table-td"><StatusBadge user={user} /></td>
                  <td className="table-td hidden lg:table-cell text-xs text-gray-400">{formatDate(user.createdAt)}</td>
                  <td className="table-td">
                    {isSelf ? (
                      <span className="text-xs text-gray-400 italic">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {!user.isApproved && user.isActive && (
                          <button
                            onClick={() => setConfirm({ action: 'approve', user, label: 'Approve User', message: `Approve access for ${user.displayName}? They will be able to log in immediately.` })}
                            disabled={!!actionLoading}
                            className="btn btn-success btn-sm">✓ Approve</button>
                        )}
                        {user.isApproved && user.role !== 'admin' && (
                          <button
                            onClick={() => setConfirm({ action: 'revoke', user, label: 'Revoke Access', message: `Revoke access for ${user.displayName}? They will be unable to log in.` })}
                            disabled={!!actionLoading}
                            className="btn btn-secondary btn-sm text-red-500">Revoke</button>
                        )}
                        <button
                          onClick={() => setConfirm({ action: 'toggle-active', user, label: user.isActive ? 'Deactivate User' : 'Activate User', message: `${user.isActive ? 'Deactivate' : 'Activate'} account for ${user.displayName}?` })}
                          disabled={!!actionLoading}
                          className="btn btn-secondary btn-sm">
                          {user.isActive ? '🔴 Deactivate' : '🟢 Activate'}
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => setConfirm({ action: 'make-admin', user, label: 'Promote to Admin', message: `Give ${user.displayName} full admin access? This grants complete system control.` })}
                            disabled={!!actionLoading}
                            className="btn btn-secondary btn-sm text-purple-600">⚙ Make Admin</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title={confirm?.label}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        variant={confirm?.action === 'revoke' || confirm?.action === 'toggle-active' ? 'danger' : 'primary'}
        loading={!!actionLoading}
      />
    </div>
  );
}
