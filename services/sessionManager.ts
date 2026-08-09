/**
 * Session Manager - Rich and smooth session handling
 * Features: Auto token refresh, connection monitoring, session persistence
 */

import { auth, enableFirestoreNetwork } from '@/config/firebase';
import { CACHE_KEYS, CACHE_TTL, getCache, setCache } from '@/services/enhancedCache';
import NetInfo from '@react-native-community/netinfo';
import { getIdToken, onAuthStateChanged, User } from 'firebase/auth';
import { AppState, AppStateStatus, type NativeEventSubscription } from 'react-native';

interface SessionState {
  isConnected: boolean;
  lastTokenRefresh: number;
  sessionStartTime: number;
  isSessionValid: boolean;
  uid: string;
  role: 'consumer' | 'supplier';
}

const TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes - more aggressive
const SESSION_TIMEOUT = 30 * 24 * 60 * 60 * 1000; // 30 days - extended for better persistence

class SessionManager {
  private static instance: SessionManager;
  private unsubscribeAuth: (() => void) | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;
  private tokenRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private currentUser: User | null = null;
  private isInitialized = false;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Monitor auth state
    this.unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      if (user) {
        this.onSessionStart(user);
      } else {
        this.onSessionEnd();
      }
    });

    // Monitor network state
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected === true && state.isInternetReachable === true;
      this.handleConnectionChange(isConnected);
    });

    // Monitor app state for session management
    this.unsubscribeAppState = AppState.addEventListener('change', this.handleAppStateChange);

    // Load cached session state
    this.loadSessionState();
  }

  private async onSessionStart(user: User): Promise<void> {
    // Immediate token refresh for fresh session
    await this.refreshToken(true);
    
    // Start auto-refresh timer
    this.startTokenRefreshTimer();
    
    // Enable Firestore network
    try {
      await enableFirestoreNetwork();
    } catch {
      // Silent fail - Firestore handles this internally
    }

    // Get user role for session tracking
    let userRole: 'consumer' | 'supplier' = 'consumer';
    try {
      const { getUserRole } = await import('@/services/authService');
      const roleResult = await getUserRole(user.uid);
      userRole = roleResult.role || 'consumer';
    } catch {
      // Default to consumer on error
      userRole = 'consumer';
    }

    // Cache session start with role and uid
    const sessionState: SessionState = {
      isConnected: true,
      lastTokenRefresh: Date.now(),
      sessionStartTime: Date.now(),
      isSessionValid: true,
      uid: user.uid,
      role: userRole,
    };
    await this.saveSessionState(sessionState);
  }

  private onSessionEnd(): void {
    this.stopTokenRefreshTimer();
    this.currentUser = null;
    this.clearSessionState();
  }

  private async refreshToken(force = false): Promise<string | null> {
    if (!this.currentUser) return null;

    try {
      const token = await getIdToken(this.currentUser, force);
      
      // Cache the token with metadata
      await setCache(CACHE_KEYS.AUTH.TOKEN, {
        token,
        refreshedAt: Date.now(),
        uid: this.currentUser.uid,
      }, {
        ttl: CACHE_TTL.AUTH.TOKEN,
        version: '1.0',
        persistent: true,
      });

      return token;
    } catch (error) {
      console.error('[SessionManager] Token refresh failed:', error);
      return null;
    }
  }

  private startTokenRefreshTimer(): void {
    this.stopTokenRefreshTimer();
    
    this.tokenRefreshTimer = setInterval(() => {
      if (this.currentUser) {
        this.refreshToken(true);
      }
    }, TOKEN_REFRESH_INTERVAL);
  }

  private stopTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  private async handleConnectionChange(isConnected: boolean): Promise<void> {
    if (!isConnected) {
      // Going offline - Firestore handles this automatically with cache
      return;
    }

    // Coming back online - smooth reconnection
    if (this.currentUser) {
      // Small delay to let network stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh token when coming back online
      await this.refreshToken(true);
      
      // Re-enable Firestore network smoothly
      try {
        await enableFirestoreNetwork();
      } catch {
        // Silent fail - Firestore handles this internally
      }
    }

    // Update session state
    const state = await this.loadSessionState();
    if (state) {
      state.isConnected = true;
      await this.saveSessionState(state);
    }
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    if (nextAppState === 'active') {
      // Check if session is still valid
      const state = await this.loadSessionState();
      if (state && !state.isSessionValid) {
        return;
      }

      // Refresh token when app comes to foreground
      if (this.currentUser) {
        await this.refreshToken(false);
      }
    }
  };

  private async loadSessionState(): Promise<SessionState | null> {
    try {
      return await getCache<SessionState>(CACHE_KEYS.AUTH.SESSION, { version: '1.0' });
    } catch {
      return null;
    }
  }

  private async saveSessionState(state: SessionState): Promise<void> {
    await setCache(CACHE_KEYS.AUTH.SESSION, state, {
      ttl: SESSION_TIMEOUT,
      version: '1.0',
      persistent: true,
    });
  }

  private async clearSessionState(): Promise<void> {
    // Session cleared via cache TTL or explicit logout
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  async getValidToken(): Promise<string | null> {
    if (!this.currentUser) return null;
    
    // Try to get cached token first
    const cached = await getCache<{ token: string; refreshedAt: number }>(
      CACHE_KEYS.AUTH.TOKEN,
      { version: '1.0' }
    );

    if (cached && Date.now() - cached.refreshedAt < TOKEN_REFRESH_INTERVAL) {
      return cached.token;
    }

    // Token expired or not cached, refresh
    return this.refreshToken(true);
  }

  async getSessionInfo(): Promise<{ uid: string; role: 'consumer' | 'supplier' } | null> {
    const state = await this.loadSessionState();
    if (!state || !state.isSessionValid) return null;
    return { uid: state.uid, role: state.role };
  }

  async restoreSession(): Promise<boolean> {
    const state = await this.loadSessionState();
    if (!state || !state.isSessionValid) return false;

    // Check if session is still within timeout
    const sessionAge = Date.now() - state.sessionStartTime;
    if (sessionAge > SESSION_TIMEOUT) {
      this.clearSessionState();
      return false;
    }

    // Session is valid, attempt to restore Firebase auth
    // Firebase auth persistence should handle this automatically
    return true;
  }

  cleanup(): void {
    this.unsubscribeAuth?.();
    this.unsubscribeNetInfo?.();
    if (this.unsubscribeAppState) {
      this.unsubscribeAppState.remove();
      this.unsubscribeAppState = null;
    }
    this.stopTokenRefreshTimer();
    this.isInitialized = false;
  }

  private unsubscribeAppState: NativeEventSubscription | null = null;

  private constructor() {
    this.isInitialized = false;
    this.unsubscribeAuth = null;
    this.unsubscribeNetInfo = null;
    this.unsubscribeAppState = null;
    this.currentUser = null;
    this.tokenRefreshTimer = null;
    this.refreshPromise = null;
  }
}

export const sessionManager = SessionManager.getInstance();
export default sessionManager;
