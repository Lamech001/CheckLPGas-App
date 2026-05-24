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
    updateDoc,
} from 'firebase/firestore';

const roleLookupCache = new Map<string, Promise<{ role: 'consumer' | 'supplier' | null; error?: string }>>();
const ROLE_CACHE_TTL = 60000; // 1 minute cache TTL for roles
const roleCacheExpiry = new Map<string, number>();

// Clean up expired role cache entries
const cleanupExpiredRoleCache = () => {
  const now = Date.now();
  for (const [key, expiry] of roleCacheExpiry.entries()) {
    if (now > expiry) {
      roleLookupCache.delete(key);
      roleCacheExpiry.delete(key);
    }
  }
};

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
  const { email, displayName } = user;
  const createdAt = serverTimestamp();

  const userData = {
    uid: user.uid,
    email: email || undefined,
    displayName: displayName || additionalData.displayName || '',
    phoneNumber: additionalData.phoneNumber || '',
    role: additionalData.role || 'consumer',
    location: additionalData.location || '',
    createdAt,
    updatedAt: createdAt,
  };

  // Try to save with retry logic
  let docSaved = false;
  let saveAttempts = 0;
  const maxAttempts = 3;

  while (!docSaved && saveAttempts < maxAttempts) {
    try {
      saveAttempts++;
      await setDoc(userRef, userData);
      docSaved = true;
    } catch (error: any) {
      console.error(`[Auth] Document save attempt ${saveAttempts} failed:`, error.message);
      if (saveAttempts >= maxAttempts) {
        throw new Error(`Failed to save user data after ${maxAttempts} attempts: ${error.message}`);
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * saveAttempts));
    }
  }

  // Verify document was saved
  try {
    const verifySnap = await getDoc(userRef);
    if (!verifySnap.exists()) {
      console.error('[Auth] Document verification failed - not found after save');
    }
  } catch (verifyError: any) {
    console.error('[Auth] Document verification error:', verifyError.message);
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
  // Clean up expired cache entries
  cleanupExpiredRoleCache();

  // Check cache first
  if (roleLookupCache.has(uid)) {
    const cachedExpiry = roleCacheExpiry.get(uid);
    if (cachedExpiry && Date.now() < cachedExpiry) {
      return roleLookupCache.get(uid)!;
    } else {
      // Cache expired, remove it
      roleLookupCache.delete(uid);
      roleCacheExpiry.delete(uid);
    }
  }

  const fetchRole = async (attempt: number): Promise<{ role: 'consumer' | 'supplier' | null; error?: string }> => {
    try {
      // Check if user is a supplier first (more specific role)
      const supplierDoc = await getDoc(doc(db, 'suppliers', uid));
      if (supplierDoc.exists()) {
        return { role: 'supplier' };
      }

      // Check if user is a consumer
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const role = (data.role as 'consumer' | 'supplier') || 'consumer';

        if (!data.role) {
          await setDoc(doc(db, 'users', uid), { role }, { merge: true });
        }

        return { role };
      }

      // Create default consumer profile
      await setDoc(doc(db, 'users', uid), {
        role: 'consumer',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      return { role: 'consumer' };
    } catch (error: any) {
      if (error.message?.includes('Target ID already exists')) {
        if (attempt < 2) {
          console.warn('[Auth] Firestore internal target collision detected, retrying getUserRole...');
          await new Promise(resolve => setTimeout(resolve, 200));
          return fetchRole(attempt + 1);
        }

        // Treat persistent target collision as transient network/offline state.
        return { role: null, error: 'offline' };
      }

      // Handle Firestore SDK internal assertion errors
      if (error.message?.includes('INTERNAL ASSERTION FAILED') ||
          error.message?.includes('Unexpected state')) {
        if (attempt < 2) {
          console.warn('[Auth] Firestore SDK internal error detected, retrying getUserRole...');
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchRole(attempt + 1);
        }

        // Treat persistent SDK errors as offline state
        return { role: null, error: 'offline' };
      }

      // Handle other Firestore errors that might be transient
      if (
        error.message?.includes('client is offline') ||
        error.message?.includes('offline') ||
        error.message?.includes('unavailable') ||
        error.message?.includes('deadline-exceeded')
      ) {
        if (attempt < 2) {
          console.warn('[Auth] Transient Firestore error detected, retrying getUserRole...');
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchRole(attempt + 1);
        }
        return { role: null, error: 'offline' };
      }

      console.warn('[Auth] Error getting user role:', error);

      return { role: null, error: error.message };
    }
  };

  const rolePromise = fetchRole(retryCount);
  roleLookupCache.set(uid, rolePromise);
  roleCacheExpiry.set(uid, Date.now() + ROLE_CACHE_TTL);

  return rolePromise;
};

// Sign in with email and password - ULTRA FAST version
// Returns immediately using cached role, updates cache in background
export const signInWithEmail = async (credentials: {
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: User; error?: string; emailNotVerified?: boolean; role?: 'consumer' | 'supplier' }> => {
  try {
    // Direct auth call - no network check to save time
    const { user } = await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );

    // Check email verification immediately
    if (!user.emailVerified) {
      sendEmailVerification(user).catch(() => {});
      return { 
        success: false, 
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        emailNotVerified: true 
      };
    }

    // Get role from Firestore - ALWAYS verify for accuracy
    let roleResult;
    try {
      roleResult = await getUserRole(user.uid);
    } catch (roleError: any) {
      // Handle Firestore SDK internal errors that might escape the retry logic
      if (roleError.message?.includes('INTERNAL ASSERTION FAILED') ||
          roleError.message?.includes('Unexpected state')) {
        console.warn('[Auth] Firestore SDK error during login, treating as offline');
        return { success: true, user, role: 'consumer' }; // Default to consumer on SDK errors
      }
      throw roleError; // Re-throw other errors
    }
    
    if (roleResult.error && !roleResult.role) {
      return { success: false, error: roleResult.error };
    }
    
    const userRole = roleResult.role || 'consumer';

    return { success: true, user, role: userRole };
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

// Sign out - Also closes supplier shop so they disappear from consumer map
export const deleteAccount = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'No authenticated user' };

    const uid = user.uid;

    // Best-effort cleanup of Firestore user documents.
    // We remove the main user doc and any supplier doc tied to this uid.
    // NOTE: If other collections reference uid, add them here.
    const userRef = doc(db, 'users', uid);
    const supplierRef = doc(db, 'suppliers', uid);

    // Dynamic import so deletion can work even if tree-shaking differs.
    const { deleteDoc } = await import('firebase/firestore');

    await Promise.all([
      deleteDoc(userRef).catch(() => undefined),
      deleteDoc(supplierRef).catch(() => undefined),
    ]);

    // Delete auth user. (May require re-auth on some cases.)
    await user.delete();

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || error?.code || 'Failed to delete account' };
  }
};

// Sign out - Also closes supplier shop so they disappear from consumer map
export const logOut = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = auth.currentUser;
    
    // If user is a supplier, close their shop before logging out
    if (user) {
      try {
        const roleResult = await getUserRole(user.uid);
        if (roleResult.role === 'supplier') {
          // Close shop so supplier disappears from consumer map
          const supplierRef = doc(db, 'suppliers', user.uid);
          await updateDoc(supplierRef, { isOpen: false });
        }
      } catch (e) {
        // Don't block logout if shop close fails
      }
    }
    
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
      return 'Looks like you already have an account! Please click the "Login" button above to sign in.';
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

