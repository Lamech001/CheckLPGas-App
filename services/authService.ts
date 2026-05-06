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
    // Check if user is a supplier first (more specific role)
    const supplierDoc = await getDoc(doc(db, 'suppliers', uid));
    if (supplierDoc.exists()) {
      return { role: 'supplier' };
    }

    // Check if user is a consumer
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return { role: data.role || 'consumer' };
    }

    return { role: null, error: 'User role not found' };
  } catch (error: any) {
    // Only log real errors, not offline issues we handle gracefully
    if (!error.message?.includes('offline') && !error.message?.includes('network')) {
      console.error('Error getting user role:', error);
    }
    
    // If offline, check if we have a cached role hint from previous session
    if (error.message?.includes('client is offline')) {
      try {
        // @ts-ignore
        const hintedRole = global.userRoleHint;
        if (hintedRole === 'supplier' || hintedRole === 'consumer') {
          return { role: hintedRole };
        }
      } catch {}
      return { role: null, error: 'offline' };
    }
    
    return { role: null, error: error.message };
  }
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

    // ULTRA FAST PATH: Check for cached role hint FIRST
    let userRole: 'consumer' | 'supplier' | null = null;
    try {
      // @ts-ignore
      userRole = global.userRoleHint;
    } catch {}

    if (userRole) {
      // Return immediately with cached role for instant navigation
      // Update cache in background for next time
      getUserRole(user.uid).then(result => {
        if (result.role) {
          try {
            // @ts-ignore
            global.userRoleHint = result.role;
          } catch {}
        }
      }).catch(() => {});
      
      return { success: true, user, role: userRole };
    }

    // First login: Get role from Firestore (slightly slower but only happens once)
    const roleResult = await getUserRole(user.uid);
    
    if (roleResult.error && !roleResult.role) {
      return { success: false, error: roleResult.error };
    }
    
    userRole = roleResult.role || 'consumer';
    
    // Cache role for instant future logins
    try {
      // @ts-ignore
      global.userRoleHint = userRole;
    } catch {}

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
        console.log('Could not close supplier shop:', e);
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

