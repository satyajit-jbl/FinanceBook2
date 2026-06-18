// import { createContext, useContext, useEffect, useState, useCallback } from 'react';
// import { onAuthStateChanged, signOut } from 'firebase/auth';
// import { auth } from '../firebase/config';
// import api from '../utils/api';

// const AuthContext = createContext(null);

// export function AuthProvider({ children }) {
//   const [firebaseUser, setFirebaseUser] = useState(null);
//   const [dbUser,       setDbUser]       = useState(null);
//   const [loading,      setLoading]      = useState(true);
//   // 'idle' | 'firebase' | 'local' | 'none'
//   const [authMode,     setAuthMode]     = useState('idle');

//   // ── Fetch DB user from backend ─────────────────────────────────
//   const fetchDbUser = useCallback(async () => {
//     try {
//       const { data } = await api.get('/auth/me');
//       setDbUser(data.user);
//       return data.user;
//     } catch (err) {
//       // 401 = no session (expected on fresh load / after logout)
//       // 404 = Firebase user exists but not yet in our DB
//       // Both are handled gracefully — just return null
//       if (err.status === 401 || err.status === 404) return null;
//       // Anything else (network error, 500) log it
//       console.error('[AuthContext] fetchDbUser unexpected error:', err);
//       return null;
//     }
//   }, []);

//   // ── On mount: check both Firebase and cookie session ──────────
//   useEffect(() => {
//     let settled = false;

//     // Listen for Firebase auth state
//     const unsubFirebase = onAuthStateChanged(auth, async (fbUser) => {
//       setFirebaseUser(fbUser);

//       if (fbUser) {
//         // Google/Firebase user
//         setAuthMode('firebase');
//         await fetchDbUser();
//         setLoading(false);
//         settled = true;
//       } else if (!settled) {
//         // No Firebase user — check for local JWT cookie
//         const dbU = await fetchDbUser();
//         if (dbU) {
//           setAuthMode('local');
//         } else {
//           setAuthMode('none');
//         }
//         setLoading(false);
//         settled = true;
//       }
//     });

//     return () => unsubFirebase();
//   }, [fetchDbUser]);

//   // ── Logout ────────────────────────────────────────────────────
//   const logout = async () => {
//     try {
//       // Clear local JWT cookie
//       await api.post('/auth/logout');
//     } catch (_) {}

//     // Sign out of Firebase (no-op if not signed in)
//     if (auth.currentUser) {
//       await signOut(auth);
//     }

//     setDbUser(null);
//     setFirebaseUser(null);
//     setAuthMode('none');
//   };

//   // ── After local register/login: set DB user directly ──────────
//   const setLocalUser = (user) => {
//     setDbUser(user);
//     setAuthMode('local');
//   };

//   const refreshUser = () => fetchDbUser().then(u => { if (u) setDbUser(u); return u; });

//   const isAdmin    = dbUser?.role === 'admin';
//   const isApproved = !!(dbUser?.isApproved && dbUser?.isActive);
//   const isLocal    = authMode === 'local' || dbUser?.provider === 'local';

//   return (
//     <AuthContext.Provider value={{
//       firebaseUser, dbUser, loading, authMode,
//       logout, refreshUser, setLocalUser,
//       isAdmin, isApproved, isLocal,
//     }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export const useAuth = () => {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// };
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import api from '../utils/api';

/*
 * HOW AUTH WORKS — READ THIS
 * ─────────────────────────────────────────────────────────────────
 * On every app startup, the browser calls GET /auth/me to check
 * whether a session already exists:
 *
 *   Case A — Google user previously logged in:
 *     Firebase SDK restores the session silently.
 *     onAuthStateChanged fires with fbUser = the Google user.
 *     api.js interceptor attaches their Bearer token.
 *     /auth/me returns 200 → user goes straight to dashboard.
 *
 *   Case B — Local (email/password) user previously logged in:
 *     Firebase has no session (fbUser = null).
 *     But the browser holds an httpOnly cookie (JWT).
 *     /auth/me returns 200 using the cookie → user goes to dashboard.
 *
 *   Case C — Nobody is logged in (fresh visit, logged out):
 *     Firebase has no session (fbUser = null).
 *     No cookie exists.
 *     /auth/me returns 401 → app shows login page.
 *     THE 401 IN THIS CASE IS INTENTIONAL. It is NOT an error.
 *     api.js suppresses the console noise for 401 on /auth/me.
 *
 * This is the standard session-check pattern used by all major apps.
 * ─────────────────────────────────────────────────────────────────
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUser,       setDbUser]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  // authMode: 'idle' | 'firebase' | 'local' | 'none'
  const [authMode,     setAuthMode]     = useState('idle');

  // ── Fetch DB user from /auth/me ───────────────────────────────────
  // Returns the user object on success, null on 401/404 (no session).
  // 401 here is expected when nobody is logged in — NOT a bug.
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

  // ── Listen to Firebase auth state ─────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Firebase user exists (Google login)
        // api.js interceptor attaches their token → /auth/me succeeds
        setAuthMode('firebase');
        const user = await fetchDbUser();
        if (!user) setAuthMode('none');
        setLoading(false);
      } else {
        // No Firebase session — try cookie-based local auth
        // If cookie exists: /auth/me → 200, if not: /auth/me → 401 (normal)
        const user = await fetchDbUser();
        setAuthMode(user ? 'local' : 'none');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchDbUser]);

  // ── Logout ────────────────────────────────────────────────────────
  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    try { if (auth.currentUser) await signOut(auth); } catch (_) {}
    setDbUser(null);
    setFirebaseUser(null);
    setAuthMode('none');
  };

  // ── Called after local login/register ────────────────────────────
  const setLocalUser = (user) => {
    setDbUser(user);
    setAuthMode('local');
  };

  const refreshUser = async () => {
    const u = await fetchDbUser();
    if (u) setDbUser(u);
    return u;
  };

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
