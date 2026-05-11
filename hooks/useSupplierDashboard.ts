/**
 * useSupplierDashboard Hook - Supplier data with caching
 * Features: instant loading, real-time updates, offline support
 */

import { db } from '@/config/firebase';
import { CACHE_KEYS, CACHE_TTL, getCache, setCache } from '@/services/cache';
import { SupplierData } from '@/services/types/supplier';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';

interface UseSupplierDashboardOptions {
  supplierId: string | null;
  enabled?: boolean;
}

interface UseSupplierDashboardReturn {
  supplier: SupplierData | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isStale: boolean;
  lastUpdated: Date | null;
}

export function useSupplierDashboard(options: UseSupplierDashboardOptions): UseSupplierDashboardReturn {
  const { supplierId, enabled = true } = options;
  
  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !!supplierId);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMounted = useRef(true);

  // Fetch supplier data (defined as regular function inside useEffect scope)
  const fetchSupplier = async (background = false) => {
    if (!supplierId || !isMounted.current) return;

    if (!background) {
      setIsLoading(true);
    }
    setIsFetching(true);
    setError(null);

    try {
      // Check cache first
      if (!background) {
        const cacheKey = CACHE_KEYS.SUPPLIERS.DETAIL(supplierId);
        const cached = await getCache<SupplierData>(cacheKey, { version: '1.0' });
        
        if (cached && isMounted.current) {
          setSupplier(cached);
          
          // Check staleness
          const { getCacheMeta } = await import('@/services/cache');
          const meta = await getCacheMeta(cacheKey);
          if (meta) {
            const age = Date.now() - meta.timestamp;
            setIsStale(age > 3 * 60 * 1000); // 3 minutes - optimized for <2s response
            setLastUpdated(new Date(meta.timestamp));
          }
          setIsLoading(false);
        }
      }

      // Fetch fresh data
      const supplierRef = doc(db, 'suppliers', supplierId);
      const supplierSnap = await getDoc(supplierRef);

      if (!isMounted.current) return;

      if (supplierSnap.exists()) {
        const data = supplierSnap.data() as SupplierData;
        setSupplier(data);
        setIsStale(false);
        setLastUpdated(new Date());

        // Cache the data
        const cacheKey = CACHE_KEYS.SUPPLIERS.DETAIL(supplierId);
        await setCache(cacheKey, data, {
          ttl: CACHE_TTL.SUPPLIERS.DETAIL,
          version: '1.0',
          persistent: true,
        });
      } else {
        setError(new Error('Supplier not found'));
      }
    } catch (err) {
      if (isMounted.current && !supplier) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    isMounted.current = true;

    if (!enabled || !supplierId) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchSupplier(false);

    // Subscribe to real-time updates
    const supplierRef = doc(db, 'suppliers', supplierId);
    unsubscribeRef.current = onSnapshot(
      supplierRef,
      (snapshot) => {
        if (!isMounted.current) return;

        if (snapshot.exists()) {
          const data = snapshot.data() as SupplierData;
          setSupplier(data);
          setIsStale(false);
          setLastUpdated(new Date());

          // Update cache
          const cacheKey = CACHE_KEYS.SUPPLIERS.DETAIL(supplierId);
          setCache(cacheKey, data, {
            ttl: CACHE_TTL.SUPPLIERS.DETAIL,
            version: '1.0',
            persistent: true,
          }).catch(() => {});
        }
      },
      (err) => {
        if (isMounted.current && !supplier) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, supplierId]);

  const refresh = async () => {
    await fetchSupplier(false);
  };

  return {
    supplier,
    isLoading,
    isFetching,
    error,
    refresh,
    isStale,
    lastUpdated,
  };
}

// Hook for updating supplier data with cache invalidation
interface UseUpdateSupplierReturn {
  updatePrices: (prices: SupplierData['prices']) => Promise<boolean>;
  updateStatus: (isOpen: boolean) => Promise<boolean>;
  updatePhone: (phoneNumber: string) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
}

export function useUpdateSupplier(supplierId: string | null): UseUpdateSupplierReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const performUpdate = async (updates: Partial<SupplierData>): Promise<boolean> => {
    if (!supplierId) return false;

    setIsLoading(true);
    setError(null);

    try {
      const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
      
      await setDoc(doc(db, 'suppliers', supplierId), {
        ...updates,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Note: Cache will be automatically updated via the onSnapshot listener
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrices = async (prices: SupplierData['prices']): Promise<boolean> => {
    return performUpdate({ prices });
  };

  const updateStatus = async (isOpen: boolean): Promise<boolean> => {
    return performUpdate({ isOpen });
  };

  const updatePhone = async (phoneNumber: string): Promise<boolean> => {
    return performUpdate({ phoneNumber });
  };

  return {
    updatePrices,
    updateStatus,
    updatePhone,
    isLoading,
    error,
  };
}

// Hook for supplier stats (cached)
export function useSupplierStats(supplierId: string | null) {
  const [stats, setStats] = useState({
    totalViews: 0,
    totalOrders: 0,
    rating: 0,
    isLoading: true,
  });

  useEffect(() => {
    if (!supplierId) return;

    const loadStats = async () => {
      try {
        // Try to get cached stats
        const cacheKey = `supplier:stats:${supplierId}`;
        const { getCache, setCache } = await import('@/services/cache');
        
        const cached = await getCache(cacheKey, { version: '1.0' });
        if (cached) {
          setStats(prev => ({ ...prev, ...cached, isLoading: false }));
        }

        // Fetch fresh stats
        const { getDoc, doc } = await import('firebase/firestore');
        const statsRef = doc(db, 'supplierStats', supplierId);
        const statsSnap = await getDoc(statsRef);

        if (statsSnap.exists()) {
          const data = statsSnap.data();
          const newStats = {
            totalViews: data.totalViews || 0,
            totalOrders: data.totalOrders || 0,
            rating: data.rating || 0,
            isLoading: false,
          };
          setStats(newStats);

          // Cache stats
          await setCache(cacheKey, newStats, {
            ttl: 5 * 60 * 1000, // 5 minutes
            version: '1.0',
          });
        }
      } catch {
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadStats();
  }, [supplierId]);

  return stats;
}
