/**
 * useUserProfile Hook - User profile data with caching
 * Features: instant loading from cache, background refresh, offline support
 */

import { db } from '@/config/firebase';
import { CACHE_KEYS, CACHE_TTL, getCache, setCache } from '@/services/cache';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  role: 'consumer' | 'supplier';
  createdAt?: string;
  photoURL?: string;
}

interface UseUserProfileOptions {
  userId: string | null;
  enabled?: boolean;
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isStale: boolean;
  lastUpdated: Date | null;
}

export function useUserProfile(options: UseUserProfileOptions): UseUserProfileReturn {
  const { userId, enabled = true } = options;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !!userId);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMounted = useRef(true);

  const fetchProfile = useCallback(async (background = false) => {
    if (!userId || !isMounted.current) return;

    if (!background) {
      setIsLoading(true);
    }
    setIsFetching(true);
    setError(null);

    try {
      // Check cache first for instant display
      if (!background) {
        const cached = await getCache<UserProfile>(CACHE_KEYS.USER.PROFILE, { version: '1.0' });
        if (cached && isMounted.current) {
          setProfile(cached);
          
          // Check staleness
          const { getCacheMeta } = await import('@/services/enhancedCache');
          const meta = await getCacheMeta(CACHE_KEYS.USER.PROFILE);
          if (meta) {
            const age = Date.now() - meta.timestamp;
            setIsStale(age > 20 * 60 * 1000); // 20 minutes - optimized for <2s response
            setLastUpdated(new Date(meta.timestamp));
          }
          setIsLoading(false);
        }
      }

      // Fetch fresh data
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (!isMounted.current) return;

      if (userSnap.exists()) {
        const data = userSnap.data();
        const profileData: UserProfile = {
          uid: userId,
          fullName: data.displayName || 'N/A',
          email: data.email || 'N/A',
          phoneNumber: data.phoneNumber || 'N/A',
          location: data.location || 'N/A',
          role: data.role || 'consumer',
          createdAt: data.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A',
          photoURL: data.photoURL,
        };

        setProfile(profileData);
        setIsStale(false);
        setLastUpdated(new Date());

        // Cache the profile
        await setCache(CACHE_KEYS.USER.PROFILE, profileData, {
          ttl: CACHE_TTL.USER.PROFILE,
          version: '1.0',
          persistent: true,
        });
      }
    } catch (err) {
      if (isMounted.current && !profile) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [userId, profile]);

  // Set up real-time listener
  useEffect(() => {
    isMounted.current = true;

    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchProfile(false);

    // Subscribe to real-time updates
    const userRef = doc(db, 'users', userId);
    unsubscribeRef.current = onSnapshot(
      userRef,
      (snapshot) => {
        if (!isMounted.current) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          const profileData: UserProfile = {
            uid: userId,
            fullName: data.displayName || 'N/A',
            email: data.email || 'N/A',
            phoneNumber: data.phoneNumber || 'N/A',
            location: data.location || 'N/A',
            role: data.role || 'consumer',
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A',
            photoURL: data.photoURL,
          };

          setProfile(profileData);
          setIsStale(false);
          setLastUpdated(new Date());

          // Update cache
          setCache(CACHE_KEYS.USER.PROFILE, profileData, {
            ttl: CACHE_TTL.USER.PROFILE,
            version: '1.0',
            persistent: true,
          }).catch(() => {});
        }
      },
      (err) => {
        if (isMounted.current && !profile) {
          setError(err);
        }
      }
    );

    return () => {
      isMounted.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [enabled, userId, fetchProfile]);

  const refresh = useCallback(async () => {
    await fetchProfile(false);
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    isFetching,
    error,
    refresh,
    isStale,
    lastUpdated,
  };
}

// Hook for updating user profile with cache invalidation
export function useUpdateUserProfile() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateProfile = useCallback(async (
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', userId), updates, { merge: true });

      // Invalidate cache
      const { removeCache } = await import('@/services/enhancedCache');
      await removeCache(CACHE_KEYS.USER.PROFILE);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { updateProfile, isLoading, error };
}
