import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUser,       setDbUser]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  // 'idle' | 'firebase' | 'local' | 'none'
  const [authMode,     setAuthMode]     = useState('idle');

  // ── Fetch DB user from backend ─────────────────────────────────
  const fetchDbUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setDbUser(data.user);
      return data.user;
    } catch (err) {
      // 401 = no session (expected on fresh load / after logout)
      // 404 = Firebase user exists but not yet in our DB
      // Both are handled gracefully — just return null
      if (err.status === 401 || err.status === 404) return null;
      // Anything else (network error, 500) log it
      console.error('[AuthContext] fetchDbUser unexpected error:', err);
      return null;
    }
  }, []);

  // ── On mount: check both Firebase and cookie session ──────────
  useEffect(() => {
    let settled = false;

    // Listen for Firebase auth state
    const unsubFirebase = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Google/Firebase user
        setAuthMode('firebase');
        await fetchDbUser();
        setLoading(false);
        settled = true;
      } else if (!settled) {
        // No Firebase user — check for local JWT cookie
        const dbU = await fetchDbUser();
        if (dbU) {
          setAuthMode('local');
        } else {
          setAuthMode('none');
        }
        setLoading(false);
        settled = true;
      }
    });

    return () => unsubFirebase();
  }, [fetchDbUser]);

  // ── Logout ────────────────────────────────────────────────────
  const logout = async () => {
    try {
      // Clear local JWT cookie
      await api.post('/auth/logout');
    } catch (_) {}

    // Sign out of Firebase (no-op if not signed in)
    if (auth.currentUser) {
      await signOut(auth);
    }

    setDbUser(null);
    setFirebaseUser(null);
    setAuthMode('none');
  };

  // ── After local register/login: set DB user directly ──────────
  const setLocalUser = (user) => {
    setDbUser(user);
    setAuthMode('local');
  };

  const refreshUser = () => fetchDbUser().then(u => { if (u) setDbUser(u); return u; });

  const isAdmin    = dbUser?.role === 'admin';
  const isApproved = !!(dbUser?.isApproved && dbUser?.isActive);
  const isLocal    = authMode === 'local' || dbUser?.provider === 'local';

  return (
    <AuthContext.Provider value={{
      firebaseUser, dbUser, loading, authMode,
      logout, refreshUser, setLocalUser,
      isAdmin, isApproved, isLocal,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
