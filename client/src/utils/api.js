import axios from 'axios';
import { auth } from '../firebase/config';
import toast from 'react-hot-toast';

/*
 * Base URL:
 *   Development → /api  (proxied by CRA to http://localhost:5000)
 *   Production  → REACT_APP_API_URL (your Vercel backend URL)
 *
 * Set in client/.env.production:
 *   REACT_APP_API_URL=https://your-server.vercel.app/api
 */
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  withCredentials: true,  // Required for httpOnly cookie auth
});

// Attach Firebase ID token for Google-auth users
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.debug('Firebase token not available:', err.message);
  }
  return config;
}, (error) => Promise.reject(error));

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg    = error.response?.data?.message || error.message || 'An unexpected error occurred';
    const status = error.response?.status;

    if (status === 403) toast.error(msg);
    else if (status === 429) toast.error('Too many requests. Please slow down.');
    else if (status >= 500) toast.error('Server error. Please try again later.');

    return Promise.reject({ message: msg, status, data: error.response?.data });
  }
);

export default api;
