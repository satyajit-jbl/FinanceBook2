// import axios from 'axios';
// import { auth } from '../firebase/config';
// import toast from 'react-hot-toast';

// /*
//  * Base URL:
//  *   Development → /api  (proxied by CRA to http://localhost:5000)
//  *   Production  → REACT_APP_API_URL (your Vercel backend URL)
//  *
//  * Set in client/.env.production:
//  *   REACT_APP_API_URL=https://your-server.vercel.app/api
//  */
// const api = axios.create({
//   baseURL: process.env.REACT_APP_API_URL || '/api',
//   timeout: 30000,
//   withCredentials: true,  // Required for httpOnly cookie auth
// });

// // Attach Firebase ID token for Google-auth users
// api.interceptors.request.use(async (config) => {
//   try {
//     const user = auth.currentUser;
//     if (user) {
//       const token = await user.getIdToken();
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//   } catch (err) {
//     console.debug('Firebase token not available:', err.message);
//   }
//   return config;
// }, (error) => Promise.reject(error));

// // ── Response interceptor ──────────────────────────────────────────
// // Global response error handling
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     const msg    = error.response?.data?.message || error.message || 'An unexpected error occurred';
//     const status = error.response?.status;

//     // 401 is INTENTIONAL on /auth/me at startup — not a real error.
//     // Suppress it so the browser console stays clean.
//     // AuthContext already handles 401 by setting authMode = 'none'.
//     if (status === 401) {
//       return Promise.reject({ message: msg, status, data: error.response?.data });
//     }

//     // Show toast for other error types

//     if (status === 403) toast.error(msg);
//     else if (status === 429) toast.error('Too many requests. Please slow down.');
//     else if (status >= 500) toast.error('Server error. Please try again later.');

//     return Promise.reject({ message: msg, status, data: error.response?.data });
//   }
// );

// export default api;

import axios from 'axios';
import { auth } from '../firebase/config';
import toast from 'react-hot-toast';

/*
 * Base URL strategy:
 *   Development → REACT_APP_API_URL (http://localhost:5000/api)
 *                 OR falls back to /api (proxied by CRA to :5000)
 *   Production  → REACT_APP_API_URL (https://finance-book2.vercel.app/api)
 */
const api = axios.create({
  baseURL:         process.env.REACT_APP_API_URL || '/api',
  timeout:         30000,
  withCredentials: true,   // send httpOnly cookie on every request
});

// ── Request interceptor ───────────────────────────────────────────
// Attach Firebase Bearer token only when a Firebase user is active.
// Local (email/password) users are authenticated via httpOnly cookie —
// no manual header needed; the browser sends it automatically.
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // Firebase SDK not ready yet — cookie will handle auth
    console.debug('[api] Firebase token unavailable:', err.message);
  }
  return config;
}, (error) => Promise.reject(error));

// ── Response interceptor ──────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg    = error.response?.data?.message || error.message || 'Unexpected error';
    const status = error.response?.status;

    // 401 is INTENTIONAL on /auth/me at startup — not a real error.
    // Suppress it so the browser console stays clean.
    // AuthContext already handles 401 by setting authMode = 'none'.
    if (status === 401) {
      return Promise.reject({ message: msg, status, data: error.response?.data });
    }

    // Show toast for other error types
    if (status === 403) toast.error(msg);
    else if (status === 429) toast.error('Too many requests. Please slow down.');
    else if (status >= 500) toast.error('Server error. Please try again later.');

    return Promise.reject({ message: msg, status, data: error.response?.data });
  }
);

export default api;
