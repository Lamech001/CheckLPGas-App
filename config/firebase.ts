import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

import { getApp, getApps, initializeApp } from 'firebase/app';

import type { Auth } from 'firebase/auth';

import { getAuth, initializeAuth } from 'firebase/auth';

// @ts-ignore - getReactNativePersistence is available but not in types

import { getReactNativePersistence } from 'firebase/auth';

import { disableNetwork, enableIndexedDbPersistence, enableNetwork, getFirestore } from 'firebase/firestore';


import { getStorage } from 'firebase/storage';



// Suppress Firebase Firestore internal errors from console (smooth UX)

// These are transport/RPC errors that Firestore handles automatically

const originalConsoleWarn = console.warn;

const originalConsoleError = console.error;



const suppressedPatterns = [

  'Backend didn\'t respond within 10 seconds',

  'WebChannelConnection RPC',

  'transport errored',

  'Could not reach Cloud Firestore backend',

  '@firebase/firestore',

  'INTERNAL ASSERTION FAILED',

  'Unexpected state',

  'FIRESTORE',

  'Firestore internal target collision detected',

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

  // Suppress Firestore internal assertion errors (SDK bug)

  if (args[0] && typeof args[0] === 'string' && 

      (args[0].includes('INTERNAL ASSERTION FAILED') || 

       args[0].includes('FIRESTORE') && args[0].includes('Unexpected state'))) {

    return;

  }

  if (shouldSuppress(args[0])) return;

  originalConsoleError.apply(console, args);

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

  auth = initializeAuth(app, {

    persistence: getReactNativePersistence(ReactNativeAsyncStorage),

  });

} else {

  // Hot reload - auth already initialized with persistence

  auth = getAuth(app);

}



// Initialize Firestore once and use the same instance across hot reloads

const db = getFirestore(app);



// Enable Firestore offline persistence (handles offline read/write until reconnect)

enableIndexedDbPersistence(db).catch((err: any) => {

  if (err.code === 'failed-precondition') {

    console.warn('[Firestore] Persistence unavailable: multiple tabs open');

  } else if (err.code === 'unimplemented') {

    console.warn('[Firestore] Persistence not available on this platform');

  }

});



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

  console.warn('Network enable warning (non-critical):', err);

});



// Auth network recovery - retry connection on network errors

const MAX_RETRIES = 3;

export const retryWithNetworkRecovery = async <T,>(

  operation: () => Promise<T>,

  retries = MAX_RETRIES

): Promise<T> => {

  try {

    return await operation();

  } catch (error: any) {

    if ((error.code === 'auth/network-request-failed' || error.message?.includes('network')) && retries > 0) {

      console.warn(`Network error, retrying... (${retries} attempts left)`);

      // Wait 1 second before retry

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to re-enable network

      await enableFirestoreNetwork().catch(() => {});

      return retryWithNetworkRecovery(operation, retries - 1);

    }

    throw error;

  }

};



export { auth, db };

export const storage = getStorage(app);

