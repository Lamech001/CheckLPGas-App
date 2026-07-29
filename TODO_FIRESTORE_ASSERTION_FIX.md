# FIRESTORE INTERNAL ASSERTION FIX

## Root Cause

`enableIndexedDbPersistence(db)` in `config/firebase.ts` causes internal assertion failures (`Unexpected state (ID: ca9)`) when Firestore SDK tries to use IndexedDB persistence through React Native's Hermes engine. This is a known incompatibility between the Firebase Web SDK (v12.14.0) and Hermes.

## Steps

- [x] Step 1: Remove `enableIndexedDbPersistence` from `config/firebase.ts`
- [x] Step 2: Add global `unhandledrejection` handler in `app/_layout.tsx` to catch FIRESTORE SDK errors that escape as uncaught promises
- [x] Step 3: Strengthen error boundary in `signInWithEmail()` in `authService.ts` to catch assertion errors
