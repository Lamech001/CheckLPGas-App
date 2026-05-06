/**
 * useAuth Hook - Authentication with intelligent caching
 * Features: cached user data, role caching, session persistence, auto-refresh
 */

import { auth, db } from '@/config/firebase';
import {
    CACHE_KEYS,
    CACHE_TTL,
    getCache,
    prefetchSingle,
    removeCache,
    setCache,
} from '@/services/cache';
import {
    User,
    signOut as firebaseSignOut,
    getIdToken,
    onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

type UserRole = 'consumer' | 'supplier' | null;

interface AuthState {
  user: User | null;
  userRole: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

interface AuthCacheData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  role: UserRole;
  cachedAt: number;
}

interface UseAuthReturn extends AuthState {
  // Actions
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
  invalidateCache: () => Promise<void>;
  
  // Cache info
  isCacheStale: boolean;
  lastCacheUpdate: Date | null;
}

// Check if running on web (for window focus detection)
const isWeb = typeof window !== 'undefined';

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    userRole: null,
    isLoading: true,
    isAuthenticated: false,
    isEmailVerified: false,
  });

  const [isCacheStale, setIsCacheStale] = useState(false);
  const [lastCacheUpdate, setLastCacheUpdate] = useState<Date | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMounted = useRef(true);

  // Load cached auth state immediately for fast startup
  const loadCachedAuth = useCallback(async () => {
    try {
      const cached = await getCache<AuthCacheData>(CACHE_KEYS.AUTH.USER, {
        version: '1.0',
      });

      if (cached && isMounted.current) {
        // Calculate cache age
        const age = Date.now() - cached.cachedAt;
        const isStale = age > CACHE_TTL.AUTH.USER;

        setIsCacheStale(isStale);
        setLastCacheUpdate(new Date(cached.cachedAt));

        // Restore user from cache (minimal user object)
        if (!state.user) {
          setState(prev => ({
            ...prev,
            userRole: cached.role,
            isEmailVerified: cached.emailVerified,
            // Note: We can't fully restore Firebase User from cache
            // but we can indicate that auth is being restored
          }));
        }

        return cached;
      }
    } catch {
      // Silent fail - will rely on Firebase auth state
    }
    return null;
  }, [state.user]);

  // Cache auth state
  const cacheAuthState = useCallback(async (user: User | null, role: UserRole) => {
    if (!user) {
      await removeCache(CACHE_KEYS.AUTH.USER);
      await removeCache(CACHE_KEYS.AUTH.USER_ROLE);
      return;
    }

    const cacheData: AuthCacheData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      role,
      cachedAt: Date.now(),
    };

    await setCache(CACHE_KEYS.AUTH.USER, cacheData, {
      ttl: CACHE_TTL.AUTH.USER,
      version: '1.0',
      persistent: true,
      priority: 'both',
    });

    if (role) {
      await setCache(CACHE_KEYS.AUTH.USER_ROLE, role, {
        ttl: CACHE_TTL.AUTH.USER_ROLE,
        version: '1.0',
        persistent: true,
      });
    }

    setLastCacheUpdate(new Date());
    setIsCacheStale(false);
  }, []);

  // Fetch user role from Firestore with caching
  const fetchUserRole = useCallback(async (uid: string): Promise<UserRole> => {
    // Check role cache first
    const cachedRole = await getCache<UserRole>(CACHE_KEYS.AUTH.USER_ROLE, {
      version: '1.0',
    });

    if (cachedRole !== null) {
      // Verify by checking user document in background
      getDoc(doc(db, 'users', uid))
        .then(userDoc => {
          if (userDoc.exists() && isMounted.current) {
            const data = userDoc.data();
            if (data.role !== cachedRole) {
              // Role changed, update cache
              setCache(CACHE_KEYS.AUTH.USER_ROLE, data.role, {
                ttl: CACHE_TTL.AUTH.USER_ROLE,
                version: '1.0',
                persistent: true,
              });
              setState(prev => ({ ...prev, userRole: data.role }));
            }
          }
        })
        .catch(() => {}); // Silent fail for background check

      return cachedRole;
    }

    // No cache, fetch fresh
    try {
      // Check if user is a consumer
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const role = data.role || 'consumer';
        await setCache(CACHE_KEYS.AUTH.USER_ROLE, role, {
          ttl: CACHE_TTL.AUTH.USER_ROLE,
          version: '1.0',
          persistent: true,
        });
        return role;
      }

      // Check if user is a supplier
      const supplierDoc = await getDoc(doc(db, 'suppliers', uid));
      if (supplierDoc.exists()) {
        await setCache(CACHE_KEYS.AUTH.USER_ROLE, 'supplier', {
          ttl: CACHE_TTL.AUTH.USER_ROLE,
          version: '1.0',
          persistent: true,
        });
        return 'supplier';
      }

      return null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }, []);

  // Main auth state listener
  useEffect(() => {
    isMounted.current = true;

    // Load cached auth for immediate UI response
    loadCachedAuth();

    // Set up Firebase auth listener
    unsubscribeRef.current = onAuthStateChanged(auth, async (user) => {
      if (!isMounted.current) return;

      if (user) {
        // User is signed in
        const role = await fetchUserRole(user.uid);
        
        setState({
          user,
          userRole: role,
          isLoading: false,
          isAuthenticated: true,
          isEmailVerified: user.emailVerified,
        });

        // Cache the auth state
        await cacheAuthState(user, role);

        // Prefetch related data
        prefetchUserData(user.uid);
      } else {
        // User is signed out
        setState({
          user: null,
          userRole: null,
          isLoading: false,
          isAuthenticated: false,
          isEmailVerified: false,
        });

        // Clear auth cache
        await invalidateAuthCache();
      }
    }, (error) => {
      console.error('Auth state error:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    // Handle window focus for web (auto-refresh auth state)
    const handleFocus = () => {
      if (state.user && !state.isLoading) {
        refreshUser();
      }
    };

    if (isWeb) {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      isMounted.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (isWeb) {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [loadCachedAuth, cacheAuthState, fetchUserRole]);

  // Prefetch user-related data
  const prefetchUserData = async (uid: string) => {
    try {
      // Prefetch user profile
      prefetchSingle(
        CACHE_KEYS.USER.PROFILE,
        async () => {
          const userDoc = await getDoc(doc(db, 'users', uid));
          return userDoc.exists() ? userDoc.data() : null;
        },
        {
          ttl: CACHE_TTL.USER.PROFILE,
          version: '1.0',
          persistent: true,
        }
      );

      // Prefetch user settings
      prefetchSingle(
        CACHE_KEYS.USER.SETTINGS,
        async () => {
          const docSnap = await getDoc(doc(db, 'userSettings', uid));
          return docSnap.exists() ? docSnap.data() : null;
        },
        { ttl: CACHE_TTL.USER.SETTINGS, version: '1.0', persistent: true }
      );
    } catch {
      // Silent fail for prefetching
    }
  };

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      await invalidateAuthCache();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, []);

  // Refresh token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    
    try {
      const token = await getIdToken(auth.currentUser, true);
      
      // Cache the token
      await setCache(CACHE_KEYS.AUTH.TOKEN, token, {
        ttl: CACHE_TTL.AUTH.TOKEN,
        version: '1.0',
        persistent: true,
      });
      
      return token;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Reload user from Firebase
      await auth.currentUser.reload();
      
      // Refresh role
      const role = await fetchUserRole(auth.currentUser.uid);
      
      setState(prev => ({
        ...prev,
        user: auth.currentUser,
        userRole: role,
        isLoading: false,
        isEmailVerified: auth.currentUser?.emailVerified ?? false,
      }));

      // Update cache
      await cacheAuthState(auth.currentUser, role);
    } catch (error) {
      console.error('Refresh user error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [cacheAuthState, fetchUserRole]);

  // Invalidate all auth cache
  const invalidateCache = useCallback(async () => {
    await invalidateAuthCache();
    setIsCacheStale(true);
    setLastCacheUpdate(null);
  }, []);

  // Helper to invalidate auth cache
  const invalidateAuthCache = async () => {
    await removeCache(CACHE_KEYS.AUTH.USER);
    await removeCache(CACHE_KEYS.AUTH.USER_ROLE);
    await removeCache(CACHE_KEYS.AUTH.TOKEN);
    await removeCache(CACHE_KEYS.AUTH.SESSION);
  };

  return {
    ...state,
    signOut,
    refreshToken,
    refreshUser,
    invalidateCache,
    isCacheStale,
    lastCacheUpdate,
  };
}

// Hook for cached user role only (lighter weight)
export function useCachedUserRole(): {
  role: UserRole;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRole = async () => {
      if (!auth.currentUser) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      // Try cache first
      const cached = await getCache<UserRole>(CACHE_KEYS.AUTH.USER_ROLE, {
        version: '1.0',
      });

      if (cached !== null) {
        setRole(cached);
        setIsLoading(false);

        // Verify in background
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.role !== cached) {
              setRole(data.role);
              await setCache(CACHE_KEYS.AUTH.USER_ROLE, data.role, {
                ttl: CACHE_TTL.AUTH.USER_ROLE,
                version: '1.0',
              });
            }
          } else {
            const supplierDoc = await getDoc(doc(db, 'suppliers', auth.currentUser.uid));
            if (supplierDoc.exists() && cached !== 'supplier') {
              setRole('supplier');
              await setCache(CACHE_KEYS.AUTH.USER_ROLE, 'supplier', {
                ttl: CACHE_TTL.AUTH.USER_ROLE,
                version: '1.0',
              });
            }
          }
        } catch {
          // Keep cached value on error
        }
      } else {
        // No cache, fetch fresh
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userRole = data.role || 'consumer';
            setRole(userRole);
            await setCache(CACHE_KEYS.AUTH.USER_ROLE, userRole, {
              ttl: CACHE_TTL.AUTH.USER_ROLE,
              version: '1.0',
            });
          } else {
            const supplierDoc = await getDoc(doc(db, 'suppliers', auth.currentUser.uid));
            if (supplierDoc.exists()) {
              setRole('supplier');
              await setCache(CACHE_KEYS.AUTH.USER_ROLE, 'supplier', {
                ttl: CACHE_TTL.AUTH.USER_ROLE,
                version: '1.0',
              });
            }
          }
        } catch {
          // Ignore errors
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadRole();
  }, []);

  const refresh = useCallback(async () => {
    if (!auth.currentUser) return;

    setIsLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const userRole = data.role || 'consumer';
        setRole(userRole);
        await setCache(CACHE_KEYS.AUTH.USER_ROLE, userRole, {
          ttl: CACHE_TTL.AUTH.USER_ROLE,
          version: '1.0',
        });
      } else {
        const supplierDoc = await getDoc(doc(db, 'suppliers', auth.currentUser.uid));
        if (supplierDoc.exists()) {
          setRole('supplier');
          await setCache(CACHE_KEYS.AUTH.USER_ROLE, 'supplier', {
            ttl: CACHE_TTL.AUTH.USER_ROLE,
            version: '1.0',
          });
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { role, isLoading, refresh };
}
