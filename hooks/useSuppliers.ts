/**
 * useSuppliers Hook - Supplier data with intelligent caching
 * Features: 30-minute polling, geo-caching, background refresh, filtering, offline-first
 */

import { getCacheMeta } from "@/services/cache";
import {
    filterByCylinderSize,
    getCachedSuppliers,
    getSupplierById,
    getSuppliersWithinRadius,
    prefetchSuppliers,
    subscribeToSupplier,
    subscribeToSuppliers,
    type CylinderSize,
    type SupplierWithDistance,
} from "@/services/cachedSupplierService";
import { useCallback, useEffect, useRef, useState } from "react";

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

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

  // Debounce location changes to prevent excessive re-fetches
  const debouncedLatitude = useDebounce(latitude, 500); // 500ms debounce
  const debouncedLongitude = useDebounce(longitude, 500);

  const [suppliers, setSuppliers] = useState<SupplierWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const subscribeLockRef = useRef(false); // Prevent overlapping subscriptions
  const networkUnsubscribeRef = useRef<(() => void) | null>(null);
  const isMounted = useRef(true);
  const lastFetchRef = useRef<{
    lat: number;
    lng: number;
    radius: number;
  } | null>(null);
  const hasDataRef = useRef(false);

  // Check if location has changed significantly (>100m)
  const hasLocationChanged = useCallback(
    (newLat: number, newLng: number, newRadius: number): boolean => {
      if (!lastFetchRef.current) return true;

      const { lat, lng, radius } = lastFetchRef.current;
      const distance = Math.sqrt(
        Math.pow(newLat - lat, 2) + Math.pow(newLng - lng, 2),
      );

      // Rough conversion: 0.001 degrees ≈ 100m
      return distance > 0.001 || radius !== newRadius;
    },
    [],
  );

  // Fetch suppliers
  const fetchSuppliers = useCallback(
    async (background = false) => {
      if (!debouncedLatitude || !debouncedLongitude || !isMounted.current)
        return;

      // Skip background refresh if location hasn't changed significantly
      if (
        background &&
        !hasLocationChanged(debouncedLatitude, debouncedLongitude, radiusKm)
      ) {
        return;
      }

      if (!background) {
        setIsLoading(true);
      }
      setIsFetching(true);
      setError(null);

      try {
        // Try to get cached data first for immediate display
        const cacheKey = `suppliers:nearby:${debouncedLatitude.toFixed(4)}:${debouncedLongitude.toFixed(4)}:${radiusKm}`;
        const cached = await getCachedSuppliers(
          debouncedLatitude,
          debouncedLongitude,
          radiusKm,
        );

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
              const fresh = await getSuppliersWithinRadius(
                debouncedLatitude,
                debouncedLongitude,
                radiusKm,
              );
              if (isMounted.current) {
                setSuppliers(fresh);
                hasDataRef.current = fresh.length > 0;
                setIsStale(false);
                setLastUpdated(new Date());
                lastFetchRef.current = {
                  lat: debouncedLatitude,
                  lng: debouncedLongitude,
                  radius: radiusKm,
                };
              }
            } else {
              setIsLoading(false);
            }
          }
        } else {
          // No cache available, fetch from Firestore
          const fresh = await getSuppliersWithinRadius(
            debouncedLatitude,
            debouncedLongitude,
            radiusKm,
          );
          if (isMounted.current) {
            setSuppliers(fresh);
            hasDataRef.current = fresh.length > 0;
            setIsStale(false);
            setLastUpdated(new Date());
            lastFetchRef.current = {
              lat: debouncedLatitude,
              lng: debouncedLongitude,
              radius: radiusKm,
            };
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
    },
    [debouncedLatitude, debouncedLongitude, radiusKm, hasLocationChanged],
  );

  // Store latest params in refs to avoid effect dependency on fetchSuppliers
  const paramsRef = useRef({
    enabled,
    debouncedLatitude,
    debouncedLongitude,
    radiusKm,
  });
  paramsRef.current = {
    enabled,
    debouncedLatitude,
    debouncedLongitude,
    radiusKm,
  };

  // Separate effect for initial fetch only (runs when params change)
  useEffect(() => {
    if (!enabled || !debouncedLatitude || !debouncedLongitude) {
      setIsLoading(false);
      return;
    }
    fetchSuppliers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debouncedLatitude, debouncedLongitude, radiusKm]);

  // Real-time subscription and polling - stable effect that uses refs
  useEffect(() => {
    isMounted.current = true;

    if (!enabled || !debouncedLatitude || !debouncedLongitude) {
      setIsLoading(false);
      return;
    }

    // CRITICAL FIX: Unsubscribe from previous subscription BEFORE creating a new one
    // to prevent Firestore "Target ID already exists" error
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current();
      } catch (e) {
        // Ignore cleanup errors
      }
      unsubscribeRef.current = null;
    }

    // Use a lock to prevent re-entrant subscriptions during async setup
    if (subscribeLockRef.current) return;
    subscribeLockRef.current = true;

    // Set up REAL-TIME subscription via Firestore onSnapshot
    // This ensures new suppliers appear instantly (within seconds)
    // without waiting for the 30-minute polling interval
    unsubscribeRef.current = subscribeToSuppliers(
      debouncedLatitude,
      debouncedLongitude,
      radiusKm,
      (updatedSuppliers, fromCache) => {
        if (!isMounted.current) return;
        // Only update from real-time events (not initial cache)
        if (!fromCache) {
          setSuppliers(updatedSuppliers);
          hasDataRef.current = updatedSuppliers.length > 0;
          setIsStale(false);
          setLastUpdated(new Date());
        }
      },
      (err) => {
        console.error("[useSuppliers] Real-time subscription error:", err);
      },
    );
    subscribeLockRef.current = false;

    // Set up polling interval (30 minutes) as a fallback
    const pollingInterval = setInterval(
      () => {
        if (isMounted.current) {
          const p = paramsRef.current;
          if (p.debouncedLatitude && p.debouncedLongitude) {
            fetchSuppliers(true); // Background refresh
          }
        }
      },
      30 * 60 * 1000,
    ); // 30 minutes

    return () => {
      isMounted.current = false;
      clearInterval(pollingInterval);
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch (e) {
          // Ignore cleanup errors
        }
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debouncedLatitude, debouncedLongitude, radiusKm]);

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
  filterSize: CylinderSize | "all";
}

interface UseFilteredSuppliersReturn extends UseSuppliersReturn {
  filteredSuppliers: SupplierWithDistance[];
  totalCount: number;
  filteredCount: number;
}

export function useFilteredSuppliers(
  options: UseFilteredSuppliersOptions,
): UseFilteredSuppliersReturn {
  const { filterSize, ...suppliersOptions } = options;
  const baseResult = useSuppliers(suppliersOptions);

  // Memoize filtered suppliers
  const filteredSuppliers = filterByCylinderSize(
    baseResult.suppliers,
    filterSize,
  );

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
  return useCallback(
    async (
      locations: { latitude: number; longitude: number; radiusKm?: number }[],
    ) => {
      const promises = locations.map((loc) =>
        prefetchSuppliers(loc.latitude, loc.longitude, loc.radiusKm ?? 1),
      );
      await Promise.all(promises);
    },
    [],
  );
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

    // CRITICAL FIX: Unsubscribe from previous subscription BEFORE creating a new one
    // to prevent Firestore "Target ID already exists" error
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current();
      } catch (e) {
        // Ignore cleanup errors
      }
      unsubscribeRef.current = null;
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
      },
    );

    return () => {
      isMounted.current = false;
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch (e) {
          // Ignore cleanup errors
        }
        unsubscribeRef.current = null;
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
