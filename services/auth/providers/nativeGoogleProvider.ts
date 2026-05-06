// Google Sign-In temporarily disabled - shows "Coming Soon" alert
// This file is kept for future implementation
/*
import { auth, db } from '@/config/firebase';
import {
    GoogleSignin,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { AuthResult, GoogleSignInProvider, UserRole } from '../types';

// Web Client ID from google-services.json
const WEB_CLIENT_ID = '722596547435-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

// Create user document in Firestore
const createUserDocument = async (
  user: User,
  additionalData: { displayName: string; phoneNumber: string; role: UserRole; location: string }
): Promise<void> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || additionalData.displayName || '',
      phoneNumber: additionalData.phoneNumber || '',
      role: additionalData.role || 'consumer',
      location: additionalData.location || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};

// Get error message from Google Sign-In error
const getGoogleSignInError = (error: any): string => {
  if (error.code === statusCodes.SIGN_IN_CANCELLED) {
    return 'Sign in was cancelled';
  } else if (error.code === statusCodes.IN_PROGRESS) {
    return 'Sign in is already in progress';
  } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services are not available';
  } else if (error.code === statusCodes.SIGN_IN_REQUIRED) {
    return 'Sign in is required';
  }
  return error.message || 'Google sign-in failed';
};

export const nativeGoogleProvider = {
    isAvailable: () => false,
    signIn: async () => ({ success: false, error: 'Coming Soon' }),
    signOut: async () => {},
};
*/

// Export for compatibility - Google Sign-In is disabled
export const nativeGoogleProvider = {
    isAvailable: () => false,
    signIn: async () => ({ success: false, error: 'Coming Soon' }),
    signOut: async () => {},
};
