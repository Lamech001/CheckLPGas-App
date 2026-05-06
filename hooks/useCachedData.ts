/**
 * useCachedData Hook - Provides smart caching with automatic refresh
 * Shows cached data immediately while fetching fresh data in background
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCachedDataOptions<T> {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  getCachedData: () => Promise<T | null>;
  saveCache: (data: T) => Promise<void>;
  ttl?: number;
  enabled?: boolean;
  refreshInterval?: number; // Auto-refresh interval in ms
}

interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isFetching: boolean; // Background fetch in progress
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
  isStale: boolean;
}

export function useCachedData<T>({
  cacheKey,
  fetchFn,
  getCachedData,
  saveCache,
  enabled = true,
  refreshInterval,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!isMounted.current) return;
    
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    setError(null);

    try {
      // Try to get cached data first for immediate display
      const cached = await getCachedData();
      if (cached && isMounted.current) {
        setData(cached);
        setIsLoading(false);
        setIsStale(true); // Data might be stale, show it while fetching
      }

      // Fetch fresh data
      const fresh = await fetchFn();
      
      if (isMounted.current) {
        setData(fresh);
        setLastUpdated(new Date());
        setIsStale(false);
        await saveCache(fresh);
      }
    } catch (err) {
      if (isMounted.current) {
        // If we have cached data, show it even on error
        if (!data) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [fetchFn, getCachedData, saveCache, data]);

  // Initial load
  useEffect(() => {
    isMounted.current = true;
    
    if (enabled) {
      fetchData(true);
    }

    return () => {
      isMounted.current = false;
    };
  }, [enabled, cacheKey]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && enabled) {
      intervalRef.current = setInterval(() => {
        fetchData(false); // Background refresh
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshInterval, enabled, fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refresh,
    lastUpdated,
    isStale,
  };
}

/**
 * Hook specifically for supplier data with caching
 */
import { cacheSuppliers, getCachedSuppliers } from '@/services/cacheService';
import { getSuppliersWithinRadius } from '@/services/supplierService';
import { SupplierWithDistance } from '@/services/types/supplier';

export function useCachedSuppliers(
  userLocation: { latitude: number; longitude: number } | null,
  radiusKm: number = 1
) {
  const fetchSuppliers = useCallback(async () => {
    if (!userLocation) throw new Error('Location not available');
    return await getSuppliersWithinRadius(
      userLocation.latitude,
      userLocation.longitude,
      radiusKm
    );
  }, [userLocation, radiusKm]);

  return useCachedData<SupplierWithDistance[]>({
    cacheKey: 'suppliers',
    fetchFn: fetchSuppliers,
    getCachedData: getCachedSuppliers,
    saveCache: cacheSuppliers,
    enabled: !!userLocation,
    refreshInterval: 30000, // Refresh every 30 seconds
  });
}
