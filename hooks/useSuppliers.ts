/**
 * useSuppliers Hook - Supplier data with intelligent caching
 * Features: 30-minute polling, geo-caching, background refresh, filtering, offline-first
 */

import { getCacheMeta } from '@/services/cache';
import {
    filterByCylinderSize,
    getCachedSuppliers,
    getSuppliersWithinRadius,
    prefetchSuppliers,
    type CylinderSize,
    type SupplierWithDistance
} from '@/services/cachedSupplierService';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSuppliersOptions {
  latitude: number | null;
  longitude: number | null;
  radiusKm?: number;
  enabled?: boolean;
}

interface UseSuppliersReturn {
  suppliers: SupplierWithDistance[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isStale: boolean;
  lastUpdated: Date | null;
  isOnline: boolean;
}

export function useSuppliers(options: UseSuppliersOptions): UseSuppliersReturn {
  const { latitude, longitude, radiusKm = 1, enabled = true } = options;

  const [suppliers, setSuppliers] = useState<SupplierWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const networkUnsubscribeRef = useRef<(() => void) | null>(null);
  const isMounted = useRef(true);
  const lastFetchRef = useRef<{ lat: number; lng: number; radius: number } | null>(null);
  const hasDataRef = useRef(false);

  // Check if location has changed significantly (>100m)
  const hasLocationChanged = useCallback((
    newLat: number, 
    newLng: number, 
    newRadius: number
  ): boolean => {
    if (!lastFetchRef.current) return true;
    
    const { lat, lng, radius } = lastFetchRef.current;
    const distance = Math.sqrt(
      Math.pow(newLat - lat, 2) + Math.pow(newLng - lng, 2)
    );
    
    // Rough conversion: 0.001 degrees ≈ 100m
    return distance > 0.001 || radius !== newRadius;
  }, []);

  // Fetch suppliers
  const fetchSuppliers = useCallback(async (background = false) => {
    if (!latitude || !longitude || !isMounted.current) return;

    // Skip background refresh if location hasn't changed significantly
    if (background && !hasLocationChanged(latitude, longitude, radiusKm)) {
      return;
    }

    if (!background) {
      setIsLoading(true);
    }
    setIsFetching(true);
    setError(null);

    try {
      // Try to get cached data first for immediate display
      const cacheKey = `suppliers:nearby:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${radiusKm}`;
      const cached = await getCachedSuppliers(latitude, longitude, radiusKm);
      
      if (cached && isMounted.current) {
        setSuppliers(cached);
        hasDataRef.current = cached.length > 0;
        
        // Check if cache is expired (30 minutes)
        const meta = await getCacheMeta(cacheKey);
        if (meta) {
          const age = Date.now() - meta.timestamp;
          const isCacheExpired = age > 30 * 60 * 1000; // 30 minutes
          setIsStale(isCacheExpired);
          setLastUpdated(new Date(meta.timestamp));
          
          // Only fetch fresh data if cache is expired or not background
          if (!background || isCacheExpired) {
            const fresh = await getSuppliersWithinRadius(latitude, longitude, radiusKm);
            if (isMounted.current) {
              setSuppliers(fresh);
              hasDataRef.current = fresh.length > 0;
              setIsStale(false);
              setLastUpdated(new Date());
              lastFetchRef.current = { lat: latitude, lng: longitude, radius: radiusKm };
            }
          } else {
            setIsLoading(false);
          }
        }
      } else {
        // No cache available, fetch from Firestore
        const fresh = await getSuppliersWithinRadius(latitude, longitude, radiusKm);
        if (isMounted.current) {
          setSuppliers(fresh);
          hasDataRef.current = fresh.length > 0;
          setIsStale(false);
          setLastUpdated(new Date());
          lastFetchRef.current = { lat: latitude, lng: longitude, radius: radiusKm };
        }
      }
    } catch (err) {
      if (isMounted.current) {
        // Only show error if we don't have cached data
        if (!hasDataRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [latitude, longitude, radiusKm, hasLocationChanged]);

  // Initial fetch and polling (every 30 minutes)
  useEffect(() => {
    isMounted.current = true;

    if (!enabled || !latitude || !longitude) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchSuppliers(false);

    // Set up polling interval (30 minutes)
    const pollingInterval = setInterval(() => {
      if (isMounted.current) {
        fetchSuppliers(true); // Background refresh
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => {
      isMounted.current = false;
      clearInterval(pollingInterval);
    };
  }, [enabled, latitude, longitude, radiusKm, fetchSuppliers]);

  // Network state monitoring removed to prevent frequent updates
  // Rely on 30-minute polling interval instead

  // Manual refresh
  const refresh = useCallback(async () => {
    lastFetchRef.current = null; // Force refresh
    await fetchSuppliers(false);
  }, [fetchSuppliers]);

  return {
    suppliers,
    isLoading,
    isFetching,
    error,
    refresh,
    isStale,
    lastUpdated,
    isOnline,
  };
}

// Hook for filtered suppliers
interface UseFilteredSuppliersOptions extends UseSuppliersOptions {
  filterSize: CylinderSize | 'all';
}

interface UseFilteredSuppliersReturn extends UseSuppliersReturn {
  filteredSuppliers: SupplierWithDistance[];
  totalCount: number;
  filteredCount: number;
}

export function useFilteredSuppliers(
  options: UseFilteredSuppliersOptions
): UseFilteredSuppliersReturn {
  const { filterSize, ...suppliersOptions } = options;
  const baseResult = useSuppliers(suppliersOptions);

  // Memoize filtered suppliers
  const filteredSuppliers = filterByCylinderSize(baseResult.suppliers, filterSize);

  return {
    ...baseResult,
    filteredSuppliers,
    suppliers: baseResult.suppliers,
    totalCount: baseResult.suppliers.length,
    filteredCount: filteredSuppliers.length,
  };
}

// Hook for prefetching suppliers
export function usePrefetchSuppliers() {
  return useCallback(async (
    locations: { latitude: number; longitude: number; radiusKm?: number }[]
  ) => {
    const promises = locations.map(loc => 
      prefetchSuppliers(loc.latitude, loc.longitude, loc.radiusKm ?? 1)
    );
    await Promise.all(promises);
  }, []);
}

// Hook for supplier detail (single supplier)
interface UseSupplierOptions {
  supplierId: string | null;
  enabled?: boolean;
}

interface UseSupplierReturn {
  supplier: SupplierWithDistance | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

import { getSupplierById, subscribeToSupplier } from '@/services/cachedSupplierService';

export function useSupplier(options: UseSupplierOptions): UseSupplierReturn {
  const { supplierId, enabled = true } = options;
  
  const [supplier, setSupplier] = useState<SupplierWithDistance | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && !!supplierId);
  const [error, setError] = useState<Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMounted = useRef(true);

  const fetchSupplier = useCallback(async () => {
    if (!supplierId || !isMounted.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getSupplierById(supplierId);
      
      if (isMounted.current) {
        if (data) {
          setSupplier({ ...data, distance: 0 });
        } else {
          setSupplier(null);
        }
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [supplierId]);

  useEffect(() => {
    isMounted.current = true;

    if (!enabled || !supplierId) {
      setIsLoading(false);
      setSupplier(null);
      return;
    }

    // Initial fetch
    fetchSupplier();

    // Set up real-time subscription
    unsubscribeRef.current = subscribeToSupplier(
      supplierId,
      (data, fromCache) => {
        if (isMounted.current && data && !fromCache) {
          setSupplier({ ...data, distance: 0 });
        }
      },
      (err) => {
        if (isMounted.current) {
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
  }, [enabled, supplierId, fetchSupplier]);

  const refresh = useCallback(async () => {
    await fetchSupplier();
  }, [fetchSupplier]);

  return {
    supplier,
    isLoading,
    error,
    refresh,
  };
}
