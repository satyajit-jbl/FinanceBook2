import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

if (
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey.includes('your-') ||
  firebaseConfig.projectId?.includes('your-')
) {
  throw new Error(
    'Firebase env vars are missing or still placeholders. ' +
    'Set REACT_APP_FIREBASE_* in client/.env, then stop and restart npm start ' +
    '(CRA only reads .env at startup — a running dev server keeps old values).'
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
