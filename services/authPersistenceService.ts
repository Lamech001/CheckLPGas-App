import { auth } from '@/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getUserRole } from './authService';
import { getPersistentSession, persistVerifiedSession } from './persistenceSessionService';

/**
 * Enhanced Auth Persistence Service
 * 
 * This service ensures users stay logged in permanently and are always directed
 * to the correct dashboard based on their user type (consumer vs supplier).
 * 
 * Key features:
 * - Monitors Firebase Auth state changes
 * - Automatically syncs local session with Firebase Auth
 * - Prevents automatic logouts
 * - Ensures correct dashboard routing
 * - Firebase Auth with AsyncStorage handles permanent sessions automatically
 */

let authStateListener: (() => void) | null = null;
let isInitialized = false;

/**
 * Initialize enhanced auth persistence monitoring
 * This should be called when the app starts
 */
export const initializeAuthPersistence = (): void => {
  if (isInitialized) {
    console.log('[AuthPersistence] Already initialized');
    return;
  }

  console.log('[AuthPersistence] 🔧 Initializing enhanced auth persistence');

  // Listen to Firebase Auth state changes
  authStateListener = onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      console.log('[AuthPersistence] ✅ User is authenticated:', user.uid);
      
      // Check if we have a local session
      const localSession = await getPersistentSession();
      
      console.log('[AuthPersistence] 📋 Local session check:', localSession ? 'Found' : 'Not found');
      
      if (localSession && localSession.uid === user.uid) {
        // Session matches, verify role is still correct
        console.log('[AuthPersistence] 🔍 Session UID matches, verifying role...');
        const roleResult = await getUserRole(user.uid);
        
        if (roleResult.role && roleResult.role === localSession.role) {
          console.log('[AuthPersistence] ✅ Session verified, role:', roleResult.role);
          // Update session timestamp to keep it fresh
          await persistVerifiedSession({
            role: localSession.role,
            uid: user.uid,
            emailVerified: user.emailVerified || false,
          });
        } else if (roleResult.role && roleResult.role !== localSession.role) {
          // Role changed, update local session
          console.log('[AuthPersistence] 🔄 Role changed, updating session to:', roleResult.role);
          await persistVerifiedSession({
            role: roleResult.role,
            uid: user.uid,
            emailVerified: user.emailVerified || false,
          });
        }
      } else {
        // No local session or UID mismatch, create new session
        console.log('[AuthPersistence] 🆕 Creating new session for user');
        const roleResult = await getUserRole(user.uid);
        
        if (roleResult.role) {
          console.log('[AuthPersistence] 💾 Persisting new session with role:', roleResult.role);
          await persistVerifiedSession({
            role: roleResult.role,
            uid: user.uid,
            emailVerified: user.emailVerified || false,
          });
        }
      }
    } else {
      console.log('[AuthPersistence] ❌ User is not authenticated');
      // Don't automatically clear local session - this allows offline access
      // The session will be validated on next app launch
    }
  }, (error) => {
    console.error('[AuthPersistence] ❌ Auth state monitoring error:', error);
  });

  isInitialized = true;
  console.log('[AuthPersistence] 🎉 Enhanced auth persistence initialized successfully');
};

/**
 * Stop auth persistence monitoring
 * Call this when user explicitly logs out
 */
export const stopAuthPersistence = (): void => {
  console.log('[AuthPersistence] Stopping auth persistence monitoring');

  if (authStateListener) {
    authStateListener();
    authStateListener = null;
  }

  isInitialized = false;
};

/**
 * Manually sync current auth state with local session
 * Useful after manual auth operations
 */
export const syncAuthState = async (): Promise<void> => {
  const user = auth.currentUser;
  
  if (user) {
    const roleResult = await getUserRole(user.uid);
    
    if (roleResult.role) {
      await persistVerifiedSession({
        role: roleResult.role,
        uid: user.uid,
        emailVerified: user.emailVerified || false,
      });
      console.log('[AuthPersistence] Auth state synced successfully');
    }
  }
};

/**
 * Check if user has a valid persistent session
 * This checks both local storage and Firebase Auth
 */
export const hasValidSession = async (): Promise<boolean> => {
  const localSession = await getPersistentSession();
  const firebaseUser = auth.currentUser;
  
  if (!localSession || !firebaseUser) {
    return false;
  }
  
  // Check if UIDs match
  if (localSession.uid !== firebaseUser.uid) {
    return false;
  }
  
  // Verify role is still correct
  const roleResult = await getUserRole(firebaseUser.uid);
  
  return roleResult.role === localSession.role;
};

/**
 * Get the current user's role from session
 * Returns null if no valid session exists
 */
export const getCurrentUserRole = async (): Promise<'consumer' | 'supplier' | null> => {
  const isValid = await hasValidSession();
  
  if (!isValid) {
    return null;
  }
  
  const session = await getPersistentSession();
  return session?.role || null;
};

/**
 * Force refresh the current session
 * Useful when you suspect session state might be stale
 */
export const refreshSession = async (): Promise<void> => {
  await syncAuthState();
  console.log('[AuthPersistence] Session refreshed');
};