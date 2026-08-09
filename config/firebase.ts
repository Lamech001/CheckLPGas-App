import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

import { getApp, getApps, initializeApp } from "firebase/app";

import type { Auth } from "firebase/auth";

import { getAuth, initializeAuth } from "firebase/auth";

// @ts-ignore - getReactNativePersistence is available but not in types
const getReactNativePersistence = require('firebase/auth').getReactNativePersistence;



import {
    disableNetwork,
    enableNetwork,
    getFirestore,
} from "firebase/firestore";

import { getStorage } from "firebase/storage";

// Utility to suppress Firestore SDK internal errors locally instead of overriding globals

const FIRESTORE_SUPPRESSED_PATTERNS = [
  "Backend didn't respond within 10 seconds",
  "WebChannelConnection RPC",
  "transport errored",
  "Could not reach Cloud Firestore backend",
  "@firebase/firestore",
  "INTERNAL ASSERTION FAILED",
  "Unexpected state",
  "FIRESTORE",
  "Firestore internal target collision detected",
];

export const isFirestoreSuppressedError = (message: string): boolean => {
  return FIRESTORE_SUPPRESSED_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
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

const isFirstLoad = getApps().length === 0;

const app = isFirstLoad ? initializeApp(firebaseConfig) : getApp();

// Initialize auth with React Native persistence (REQUIRED for React Native)

// Must use initializeAuth on first load BEFORE any getAuth calls

let auth: Auth;

if (isFirstLoad) {
  // First app load - initialize with AsyncStorage persistence
  // This ensures users stay logged in across app restarts
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
  
  // Configure auth settings for better persistence
  // These settings help maintain sessions across app closures
  auth.tenantId = null; // Clear any tenant-specific restrictions
} else {
  // Hot reload - auth already initialized with persistence

  auth = getAuth(app);
  
  // Ensure persistence is still active on hot reload
  auth.tenantId = null;
}

// Initialize Firestore once and use the same instance across hot reloads

const db = getFirestore(app);

// Firestore offline persistence disabled (known assertion failure bug with Hermes engine)
// The app uses custom AsyncStorage-based caching instead (see cacheService.ts, enhancedCache.ts)

let enableNetworkPromise: Promise<void> | null = null;

let disableNetworkPromise: Promise<void> | null = null;

export const enableFirestoreNetwork = async (): Promise<void> => {
  if (enableNetworkPromise) {
    return enableNetworkPromise;
  }

  enableNetworkPromise = enableNetwork(db).finally(() => {
    enableNetworkPromise = null;
  });

  return enableNetworkPromise!;
};

export const disableFirestoreNetwork = async (): Promise<void> => {
  if (disableNetworkPromise) {
    return disableNetworkPromise;
  }

  disableNetworkPromise = disableNetwork(db).finally(() => {
    disableNetworkPromise = null;
  });

  return disableNetworkPromise!;
};

// Explicitly enable network to fix offline startup issues

enableFirestoreNetwork().catch((err) => {
  console.warn("Network enable warning (non-critical):", err);
});

// Auth network recovery - retry connection on network errors

const MAX_RETRIES = 3;

export const retryWithNetworkRecovery = async <T>(
  operation: () => Promise<T>,

  retries = MAX_RETRIES,
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (
      (error.code === "auth/network-request-failed" ||
        error.message?.includes("network")) &&
      retries > 0
    ) {
      console.warn(`Network error, retrying... (${retries} attempts left)`);

      // Wait 1 second before retry

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to re-enable network

      await enableFirestoreNetwork().catch(() => {});

      return retryWithNetworkRecovery(operation, retries - 1);
    }

    throw error;
  }
};

export { auth, db };

export const storage = getStorage(app);
