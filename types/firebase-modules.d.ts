// Minimal module declarations to silence TS7016 "could not find a declaration file" issues
// for Firebase sub-modules (firestore/storage) in React Native/Expo projects.
//
// The SDK itself is runtime-compatible; this file only fixes editor/TypeScript typing.

declare module 'firebase/firestore';
declare module 'firebase/storage';

