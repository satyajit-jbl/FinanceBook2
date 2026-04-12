import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function PendingApprovalPage() {
  const { logout, dbUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="card p-10">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Pending Approval</h1>
          <p className="text-gray-500 text-sm mb-6">
            Hi <strong>{dbUser?.displayName}</strong>, your account is awaiting administrator approval.
            You'll be able to access the system once an admin reviews your request.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-6">
            Please contact your administrator to expedite the approval process.
          </div>
          <button onClick={handleLogout} className="btn btn-secondary w-full justify-center">Sign Out</button>
        </div>
      </div>
    </div>
  );
}
