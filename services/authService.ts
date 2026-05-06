import { auth, db } from '@/config/firebase';
import NetInfo from '@react-native-community/netinfo';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User
} from 'firebase/auth';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
// Google Sign-In provider - commented out until native build is ready
// import { nativeGoogleProvider } from './auth/providers/nativeGoogleProvider';

// Check network connectivity
const checkNetworkConnection = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch {
    return false;
  }
};

// Retry wrapper for Firebase auth operations
const retryAuthOperation = async <T,>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on network errors
      if (error.code === 'auth/network-request-failed' || 
          error.message?.includes('network') ||
          error.message?.includes('offline')) {
        if (attempt < maxRetries - 1) {
          console.log(`Auth retry attempt ${attempt + 1}/${maxRetries} after network error...`);
          await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
          continue;
        }
      }
      
      // Non-network error or max retries reached - throw immediately
      throw error;
    }
  }
  
  throw lastError;
};

// User types
export type UserRole = 'consumer' | 'supplier';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  role: UserRole;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create a new user document in Firestore
const createUserDocument = async (
  user: User, 
  additionalData: Partial<UserData>
): Promise<void> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);

if (!userSnapshot.exists()) {
    const { email, displayName } = user;
    const createdAt = serverTimestamp();

    try {
      await setDoc(userRef, {
        uid: user.uid,
        email: email || undefined,
        displayName: displayName || additionalData.displayName || '',
        phoneNumber: additionalData.phoneNumber || '',
        role: additionalData.role || 'consumer',
        location: additionalData.location || '',
        createdAt,
        updatedAt: createdAt,
      });
    } catch (error) {
      console.error('Error creating user document:', error);
      throw error;
    }
  }
};

// Sign up with email and password
export const signUpWithEmail = async (userData: {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: UserRole;
  location: string;
}): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    // Check network first
    const isOnline = await checkNetworkConnection();
    if (!isOnline) {
      return { success: false, error: 'No internet connection. Please check your network and try again.' };
    }

    const userCredential = await retryAuthOperation(() =>
      createUserWithEmailAndPassword(auth, userData.email, userData.password)
    );

    const firebaseUser = userCredential.user;

    // Update display name
    await updateProfile(firebaseUser, {
      displayName: userData.fullName,
    });

    // Create user document in Firestore (parallel with email)
    const userDocPromise = createUserDocument(firebaseUser, {
      displayName: userData.fullName,
      phoneNumber: userData.phoneNumber,
      role: userData.role,
      location: userData.location,
    });

    // Send email verification in background (don't block response)
    const emailPromise = sendEmailVerification(firebaseUser)
      .catch(err => console.error('Email verification failed:', err));

    // Wait for user document, but don't wait for email
    await userDocPromise;
    
    // Fire email promise in background
    emailPromise;

    return { success: true, user: firebaseUser };
  } catch (error: any) {
    console.error('Signup error:', error);
    const errorMessage = getAuthErrorMessage(error.code);
    return { success: false, error: errorMessage };
  }
};

// Get user role from Firestore
export const getUserRole = async (uid: string, retryCount = 0): Promise<{ role: 'consumer' | 'supplier' | null; error?: string }> => {
  try {
    // Check if user is a consumer
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return { role: data.role || 'consumer' };
    }

    // Check if user is a supplier
    const supplierDoc = await getDoc(doc(db, 'suppliers', uid));
    if (supplierDoc.exists()) {
      return { role: 'supplier' };
    }

    return { role: null, error: 'User role not found' };
  } catch (error: any) {
    // Only log real errors, not offline issues we handle gracefully
    if (!error.message?.includes('offline') && !error.message?.includes('network')) {
      console.error('Error getting user role:', error);
    }
    
    // For login flow, don't retry - return error immediately for speed
    if (error.message?.includes('client is offline')) {
      return { role: null, error: 'offline' };
    }
    
    return { role: null, error: error.message };
  }
};

// Sign in with email and password - ULTRA FAST version
// No network check delay - Firebase handles offline/online automatically
export const signInWithEmail = async (credentials: {
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: User; error?: string; emailNotVerified?: boolean; role?: 'consumer' | 'supplier' }> => {
  try {
    // Direct auth call - no network check to save time
    // Firebase will succeed immediately if credentials are cached, or fail fast if offline
    const { user } = await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );

    // Check email verification immediately (no reload needed, auth response is fresh)
    if (!user.emailVerified) {
      // Fire-and-forget verification email
      sendEmailVerification(user).catch(() => {});
      return { 
        success: false, 
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        emailNotVerified: true 
      };
    }

    // SUPER FAST PATH: Assume consumer and return immediately (90% of users)
    // Fetch role asynchronously in background for next login
    getUserRole(user.uid).then(roleResult => {
      if (roleResult.role && roleResult.role !== 'consumer') {
        // Store role hint for next time
        try {
          // @ts-ignore
          global.userRoleHint = roleResult.role;
        } catch {}
      }
    }).catch(() => {});

    // Check if we have a role hint from previous check
    // @ts-ignore
    const hintedRole = global.userRoleHint;
    if (hintedRole === 'supplier') {
      return { success: true, user, role: 'supplier' };
    }

    // Default to consumer for instant response
    return { success: true, user, role: 'consumer' };
  } catch (error: any) {
    console.error('Login error:', error);
    const errorMessage = getAuthErrorMessage(error.code);
    return { success: false, error: errorMessage };
  }
};

// Sign in with Google - React Native only
// Commented out until native build is ready with @react-native-google-signin/google-signin
/*
export const signInWithGoogle = async (role: UserRole = 'consumer'): Promise<{
  success: boolean;
  user?: User;
  error?: string;
}> => {
  try {
    // Use native provider for mobile apps (Android/iOS)
    return nativeGoogleProvider.signIn(role);
  } catch (error: any) {
    console.error('Google sign in error:', error);
    const errorMessage = getAuthErrorMessage(error.code);
    return { success: false, error: errorMessage };
  }
};
*/

// Placeholder for Google Sign-In - shows coming soon message
export const signInWithGoogle = async (_role: UserRole = 'consumer'): Promise<{
  success: boolean;
  user?: User;
  error?: string;
}> => {
  return { success: false, error: 'Google Sign-In is coming soon!' };
};

// Sign out
export const logOut = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Auth state listener
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get user data from Firestore
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      return userSnapshot.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (
  uid: string, 
  data: Partial<UserData>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
export const resetPassword = async (email: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: any) {
    console.error('Password reset error:', error);
    const errorMessage = getAuthErrorMessage(error.code);
    return { success: false, error: errorMessage };
  }
};

// Helper function to get error messages
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in or use a different email.';
    case 'auth/invalid-email':
      return 'Invalid email address. Please enter a valid email.';
    case 'auth/operation-not-allowed':
      return 'Operation not allowed. Please contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use a stronger password (at least 6 characters).';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please check your email and password.';
    case 'auth/invalid-persistence-type':
    case 'auth/unsupported-persistence-type':
      return 'Authentication error. Please try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return 'An error occurred. Please try again.';
  }
};

export { };

