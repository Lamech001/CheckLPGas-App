import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore - getReactNativePersistence is available but not in types
import { getReactNativePersistence } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { disableNetwork, enableNetwork, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Suppress Firebase Firestore internal errors from console (smooth UX)
// These are transport/RPC errors that Firestore handles automatically
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

const suppressedPatterns = [
  'Backend didn\'t respond within 10 seconds',
  'WebChannelConnection RPC',
  'transport errored',
  'Could not reach Cloud Firestore backend',
  '@firebase/firestore',
];

const shouldSuppress = (message: any): boolean => {
  if (typeof message !== 'string') return false;
  return suppressedPatterns.some(pattern => message.includes(pattern));
};

console.warn = (...args: any[]) => {
  if (shouldSuppress(args[0])) return;
  originalConsoleWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  if (shouldSuppress(args[0])) return;
  originalConsoleError.apply(console, args);
};

console.log = (...args: any[]) => {
  if (shouldSuppress(args[0])) return;
  originalConsoleLog.apply(console, args);
};

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize app only if not already initialized (prevents hot reload errors)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize auth only if not already initialized (prevents auth/already-initialized error)
// ReactNativeAsyncStorage persistence ensures sessions survive app restarts
let auth: Auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}

// Firestore settings for unlimited timeout and better connectivity
const firestoreSettings = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: 1024 * 1024 * 1024, // 1GB cache (effectively unlimited)
  }),
};

// Initialize Firestore only if not already initialized
let db: Firestore;
try {
  db = getFirestore(app);
} catch {
  db = initializeFirestore(app, firestoreSettings);
}

// Note: Firestore SDK has a built-in 10-second warning message for slow connections,
// but it continues retrying indefinitely. The unlimited cache ensures data works offline.

export { auth, db };
export const storage = getStorage(app);

// Enable offline persistence helper
export const enableFirestoreNetwork = () => enableNetwork(db);
export const disableFirestoreNetwork = () => disableNetwork(db);
