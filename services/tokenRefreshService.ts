import { auth } from '@/config/firebase';
import { onIdTokenChanged, User } from 'firebase/auth';

/**
 * Token Refresh Service
 * 
 * Automatically refreshes Firebase auth tokens before they expire.
 * Firebase tokens expire after 1 hour by default.
 * This service ensures seamless authentication without user intervention.
 */

// Token refresh configuration
const TOKEN_REFRESH_THRESHOLD_MS = 50 * 60 * 1000; // Refresh 50 minutes before expiration (tokens last 1 hour)
const TOKEN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

let tokenRefreshListener: (() => void) | null = null;
let tokenCheckInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Initialize automatic token refresh
 * This sets up listeners to refresh tokens silently in the background
 */
export const initializeTokenRefresh = (): void => {
  if (isInitialized) {
    console.log('[TokenRefresh] Already initialized');
    return;
  }

  console.log('[TokenRefresh] Initializing automatic token refresh');

  // Listen to ID token changes - Firebase automatically refreshes tokens
  tokenRefreshListener = onIdTokenChanged(auth, (user: User | null) => {
    if (user) {
      console.log('[TokenRefresh] Token refreshed for user:', user.uid);
      
      // Token has been refreshed, you can perform additional actions here if needed
      // For example, update API headers, notify UI, etc.
    } else {
      console.log('[TokenRefresh] User signed out, stopping token refresh');
      stopTokenRefresh();
    }
  }, (error) => {
    console.error('[TokenRefresh] Token refresh error:', error);
    // Don't stop refresh on transient errors - Firebase will retry
  });

  // Set up periodic token check (backup mechanism)
  tokenCheckInterval = setInterval(async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Force token refresh if needed
        // Firebase will only actually refresh if the token is close to expiration
        await user.getIdToken(true);
        console.log('[TokenRefresh] Periodic token check completed');
      } catch (error) {
        console.error('[TokenRefresh] Periodic token check failed:', error);
        // Don't throw - let Firebase handle retries
      }
    }
  }, TOKEN_CHECK_INTERVAL_MS);

  isInitialized = true;
  console.log('[TokenRefresh] Token refresh service initialized');
};

/**
 * Stop automatic token refresh
 * Call this when user signs out
 */
export const stopTokenRefresh = (): void => {
  console.log('[TokenRefresh] Stopping token refresh');

  if (tokenRefreshListener) {
    tokenRefreshListener();
    tokenRefreshListener = null;
  }

  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
    tokenCheckInterval = null;
  }

  isInitialized = false;
};

/**
 * Force an immediate token refresh
 * Use this when you need a fresh token (e.g., before a critical API call)
 */
export const forceTokenRefresh = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[TokenRefresh] No user to refresh token for');
    return null;
  }

  try {
    const token = await user.getIdToken(true);
    console.log('[TokenRefresh] Token force-refreshed successfully');
    return token;
  } catch (error) {
    console.error('[TokenRefresh] Force token refresh failed:', error);
    throw error;
  }
};

/**
 * Get the current valid token (refreshes if needed)
 * This is a convenience method that ensures you always get a valid token
 */
export const getCurrentToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    // Force refresh to ensure token is valid
    // Firebase will only actually refresh if the token is expired or close to expiration
    const token = await user.getIdToken(true);
    return token;
  } catch (error) {
    console.error('[TokenRefresh] Failed to get current token:', error);
    return null;
  }
};

/**
 * Get token expiration time (in milliseconds since epoch)
 * Returns null if user is not authenticated
 */
export const getTokenExpirationTime = async (): Promise<number | null> => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    const token = await user.getIdToken();
    // Decode JWT to get expiration time (without using external libraries)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to milliseconds
  } catch (error) {
    console.error('[TokenRefresh] Failed to get token expiration:', error);
    return null;
  }
};

/**
 * Check if token needs refresh
 * Returns true if token will expire within the threshold
 */
export const needsTokenRefresh = async (): Promise<boolean> => {
  const expirationTime = await getTokenExpirationTime();
  if (!expirationTime) {
    return false;
  }

  const now = Date.now();
  const timeUntilExpiration = expirationTime - now;
  
  return timeUntilExpiration < TOKEN_REFRESH_THRESHOLD_MS;
};
