/**
 * Cached Supplier Service - Supplier operations with intelligent caching
 * Features: geo-caching, background refresh, batch operations, real-time sync
 */

import { db } from '@/config/firebase';
import {
  batchGetCache,
  batchSetCache,
  CACHE_KEYS,
  CACHE_TTL,
  getCache,
  getOrFetch,
  prefetchCache,
  removeCache,
  setCache,
  type CacheOptions,
} from '@/services/enhancedCache';
import { collection, doc, getDoc, getDocs, onSnapshot, query } from 'firebase/firestore';
import { CylinderSize, SupplierData, SupplierWithDistance } from './types/supplier';

// Re-export types
export { CylinderSize, SupplierData, SupplierWithDistance };

// Calculate distance between two coordinates using Haversine formula
// Returns distance in kilometers with high precision
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers (mean radius)
  const toRad = (value: number) => value * (Math.PI / 180);
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

const MAX_NEARBY_RADIUS_KM = 1;

// Generate cache key for location-based queries
const generateNearbyCacheKey = (
  lat: number,
  lng: number,
  radiusKm: number
): string => {
  const effectiveRadiusKm = Math.min(radiusKm, MAX_NEARBY_RADIUS_KM);

  // Round coordinates to reduce cache fragmentation (4 decimal places = ~11m precision)
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  return CACHE_KEYS.SUPPLIERS.NEARBY(roundedLat, roundedLng, effectiveRadiusKm);
};

/**
 * Fetch open suppliers within radius with caching
 * Implements stale-while-revalidate pattern
 */
export const getSuppliersWithinRadius = async (
  userLat: number,
  userLon: number,
  radiusKm: number = MAX_NEARBY_RADIUS_KM
): Promise<SupplierWithDistance[]> => {
  const effectiveRadiusKm = Math.min(radiusKm, MAX_NEARBY_RADIUS_KM);
  const cacheKey = generateNearbyCacheKey(userLat, userLon, effectiveRadiusKm);

  return getOrFetch(
    cacheKey,
    async () => {
      // Fetch all suppliers and filter client-side to handle missing isOpen field
      const suppliersQuery = query(collection(db, 'suppliers'));
      const querySnapshot = await getDocs(suppliersQuery);
      
      
      const suppliers = querySnapshot.docs
        .map((doc) => {
          const data = doc.data() as SupplierData;
          const distance = calculateDistance(
            userLat,
            userLon,
            data.location.latitude,
            data.location.longitude
          );
          return { data, distance };
        })
        .filter(({ data, distance }) => {
          // Filter by distance
          if (distance > effectiveRadiusKm) return false;
          // Filter by isOpen status (default to true if field is missing)
          return data.isOpen !== false; // Include if isOpen is true or undefined
        })
        .map(({ data, distance }) => ({ ...data, distance }))
        .sort((a, b) => a.distance - b.distance);

      return suppliers;
    },
    {
      ttl: CACHE_TTL.SUPPLIERS.NEARBY,
      backgroundRefresh: true,
      persistent: true,
      maxAge: Infinity,
    }
  ).then(result => result.data);
};

/**
 * Get cached suppliers only (no fetch)
 */
export const getCachedSuppliers = async (
  userLat: number,
  userLon: number,
  radiusKm: number = MAX_NEARBY_RADIUS_KM
): Promise<SupplierWithDistance[] | null> => {
  const effectiveRadiusKm = Math.min(radiusKm, MAX_NEARBY_RADIUS_KM);
  const cacheKey = generateNearbyCacheKey(userLat, userLon, effectiveRadiusKm);
  return getCache<SupplierWithDistance[]>(cacheKey, { maxAge: Infinity });
};

/**
 * Get supplier by ID with caching
 */
export const getSupplierById = async (
  supplierId: string
): Promise<SupplierData | null> => {
  const cacheKey = CACHE_KEYS.SUPPLIERS.DETAIL(supplierId);

  return getOrFetch(
    cacheKey,
    async () => {
      const supplierRef = doc(db, 'suppliers', supplierId);
      const supplierSnap = await getDoc(supplierRef);
      
      if (supplierSnap.exists()) {
        return supplierSnap.data() as SupplierData;
      }
      return null;
    },
    {
      ttl: CACHE_TTL.SUPPLIERS.DETAIL,
      backgroundRefresh: true,
      persistent: true,
    }
  ).then(result => result.data);
};

/**
 * Get multiple suppliers by IDs with batch caching
 */
export const getSuppliersByIds = async (
  supplierIds: string[]
): Promise<Map<string, SupplierData | null>> => {
  const cacheKeys = supplierIds.map(id => CACHE_KEYS.SUPPLIERS.DETAIL(id));
  
  // Batch read from cache
  const cachedResults = await batchGetCache<SupplierData>(cacheKeys);
  
  // Find missing suppliers
  const missingIds: string[] = [];
  const results = new Map<string, SupplierData | null>();
  
  for (let i = 0; i < supplierIds.length; i++) {
    const id = supplierIds[i];
    const cached = cachedResults.get(cacheKeys[i]);
    
    if (cached) {
      results.set(id, cached);
    } else {
      missingIds.push(id);
    }
  }
  
  // Fetch missing suppliers in parallel
  if (missingIds.length > 0) {
    const fetchPromises = missingIds.map(async (id) => {
      const supplierRef = doc(db, 'suppliers', id);
      const supplierSnap = await getDoc(supplierRef);
      
      if (supplierSnap.exists()) {
        const data = supplierSnap.data() as SupplierData;
        results.set(id, data);
        return { id, data };
      }
      results.set(id, null);
      return { id, data: null };
    });
    
    const fetched = await Promise.all(fetchPromises);
    
    // Batch cache the results
    const cacheEntries = fetched
      .filter(({ data }) => data !== null)
      .map(({ id, data }) => ({
        key: CACHE_KEYS.SUPPLIERS.DETAIL(id),
        data,
        options: { ttl: CACHE_TTL.SUPPLIERS.DETAIL } as CacheOptions,
      }));
    
    await batchSetCache(cacheEntries);
  }
  
  return results;
};

/**
 * Subscribe to suppliers with smart caching
 * Returns cached data immediately, then updates in real-time
 */
export const subscribeToSuppliers = (
  userLat: number,
  userLon: number,
  radiusKm: number,
  callback: (suppliers: SupplierWithDistance[], fromCache: boolean) => void,
  onError?: (error: Error) => void
) => {
  const effectiveRadiusKm = Math.min(radiusKm, MAX_NEARBY_RADIUS_KM);
  const cacheKey = generateNearbyCacheKey(userLat, userLon, effectiveRadiusKm);
  let initialCallbackFired = false;

  // Get cached data first for immediate display
  const cachedPromise = getCache<SupplierWithDistance[]>(cacheKey);

  // Consume the cached result for the initial UI paint.
  cachedPromise.then((cached) => {
    // Use the value even if empty/undefined; only suppress duplicate initial fires.
    if (!initialCallbackFired && cached) {
      callback(cached, true);
    }
  });



  // Set up real-time listener
  const suppliersQuery = query(collection(db, 'suppliers'));
  
  return onSnapshot(
    suppliersQuery,
    (snapshot) => {
      initialCallbackFired = true;
      
      const suppliers = snapshot.docs
        .map((doc) => {
          const data = doc.data() as SupplierData;
          const distance = calculateDistance(
            userLat,
            userLon,
            data.location.latitude,
            data.location.longitude
          );
          return { data, distance };
        })
        .filter(({ data, distance }) => {
          // Filter by distance
          if (distance > effectiveRadiusKm) return false;
          // Filter by isOpen status (default to true if field is missing)
          return data.isOpen !== false; // Include if isOpen is true or undefined
        })
        .map(({ data, distance }) => ({ ...data, distance }))
        .sort((a, b) => a.distance - b.distance);

      // Update cache with fresh data
      setCache(cacheKey, suppliers, {
        ttl: CACHE_TTL.SUPPLIERS.NEARBY,
        persistent: true,
      }).catch(() => {});

      callback(suppliers, false);
    },
    (error) => {
      console.error('Supplier subscription error:', error);
      onError?.(error);
    }
  );
};

/**
 * Subscribe to single supplier with caching
 */
export const subscribeToSupplier = (
  supplierId: string,
  callback: (supplier: SupplierData | null, fromCache: boolean) => void,
  onError?: (error: Error) => void
) => {
  const cacheKey = CACHE_KEYS.SUPPLIERS.DETAIL(supplierId);
  let initialCallbackFired = false;

  // Get cached data first
  getCache<SupplierData>(cacheKey).then(cached => {
    if (cached && !initialCallbackFired) {
      callback(cached, true);
    }
  });

  // Set up real-time listener
  const supplierRef = doc(db, 'suppliers', supplierId);
  
  return onSnapshot(
    supplierRef,
    (snapshot) => {
      initialCallbackFired = true;
      
      if (snapshot.exists()) {
        const data = snapshot.data() as SupplierData;
        
        // Update cache
        setCache(cacheKey, data, {
          ttl: CACHE_TTL.SUPPLIERS.DETAIL,
          persistent: true,
        }).catch(() => {});

        callback(data, false);
      } else {
        callback(null, false);
      }
    },
    (error) => {
      console.error('Supplier subscription error:', error);
      onError?.(error);
    }
  );
};

/**
 * Filter suppliers by cylinder size
 * Works on cached or fresh data
 */
export const filterByCylinderSize = (
  suppliers: SupplierWithDistance[],
  size: CylinderSize | 'all'
): SupplierWithDistance[] => {
  if (size === 'all') return suppliers;
  
  return suppliers.filter((supplier) =>
    supplier.prices.some((price) => price.size === size && price.inStock)
  );
};

/**
 * Cache management for suppliers
 */
export const invalidateSupplierCache = async (supplierId?: string): Promise<void> => {
  if (supplierId) {
    // Invalidate specific supplier
    await removeCache(CACHE_KEYS.SUPPLIERS.DETAIL(supplierId));
    await removeCache(CACHE_KEYS.SUPPLIERS.PRICES(supplierId));
  } else {
    // Invalidate all supplier caches
    const keys = await getAllSupplierCacheKeys();
    for (const key of keys) {
      await removeCache(key);
    }
  }
};

/**
 * Prefetch suppliers for a location
 */
export const prefetchSuppliers = async (
  lat: number,
  lng: number,
  radiusKm: number = MAX_NEARBY_RADIUS_KM
): Promise<void> => {
  const effectiveRadiusKm = Math.min(radiusKm, MAX_NEARBY_RADIUS_KM);
  const cacheKey = generateNearbyCacheKey(lat, lng, effectiveRadiusKm);
  
  await prefetchCache(
    cacheKey,
    async () => {
      // Fetch all suppliers and filter client-side to handle missing isOpen field
      const suppliersQuery = query(collection(db, 'suppliers'));
      const querySnapshot = await getDocs(suppliersQuery);
      
      return querySnapshot.docs
        .map((doc) => {
          const data = doc.data() as SupplierData;
          const distance = calculateDistance(
            lat,
            lng,
            data.location.latitude,
            data.location.longitude
          );
          return { ...data, distance };
        })
        .filter((s) => {
          // Filter by distance
          if (s.distance > effectiveRadiusKm) return false;
          // Filter by isOpen status (default to true if field is missing)
          return s.isOpen !== false; // Include if isOpen is true or undefined
        })
        .sort((a, b) => a.distance - b.distance);
    },
    {
      ttl: CACHE_TTL.SUPPLIERS.NEARBY,
      persistent: true,
    }
  );
};

/**
 * Prefetch multiple suppliers by IDs
 */
export const prefetchSupplierDetails = async (
  supplierIds: string[]
): Promise<void> => {
  const promises = supplierIds.map(id => 
    prefetchCache(
      CACHE_KEYS.SUPPLIERS.DETAIL(id),
      async () => {
        const supplierRef = doc(db, 'suppliers', id);
        const supplierSnap = await getDoc(supplierRef);
        return supplierSnap.exists() ? (supplierSnap.data() as SupplierData) : null;
      },
      {
        ttl: CACHE_TTL.SUPPLIERS.DETAIL,
        persistent: true,
      }
    )
  );
  
  await Promise.all(promises);
};

/**
 * Warm cache for multiple locations
 * Useful for pre-caching data for areas the user frequently visits
 */
export const warmSupplierCache = async (
  locations: { lat: number; lng: number; radiusKm?: number }[]
): Promise<void> => {
  const promises = locations.map(loc => 
    prefetchSuppliers(loc.lat, loc.lng, loc.radiusKm ?? 1)
  );
  
  await Promise.all(promises);
};

/**
 * Get supplier cache statistics
 */
export const getSupplierCacheStats = async (): Promise<{
  nearbyCaches: number;
  detailCaches: number;
  favoriteCaches: number;
  totalSuppliersCached: number;
}> => {
  const allKeys = await getAllSupplierCacheKeys();
  
  const nearbyCount = allKeys.filter(k => k.includes('nearby')).length;
  const detailCount = allKeys.filter(k => k.includes('detail')).length;
  const favoriteCount = allKeys.filter(k => k.includes('favorites')).length;
  
  // Count total unique suppliers in detail cache
  const supplierIds = new Set(
    allKeys
      .filter(k => k.includes('detail:'))
      .map(k => k.split('detail:')[1])
  );
  
  return {
    nearbyCaches: nearbyCount,
    detailCaches: detailCount,
    favoriteCaches: favoriteCount,
    totalSuppliersCached: supplierIds.size,
  };
};

/**
 * Helper: Get all supplier cache keys
 */
const getAllSupplierCacheKeys = async (): Promise<string[]> => {
  const { getCacheKeys } = await import('@/services/enhancedCache');
  const allKeys = await getCacheKeys();
  return allKeys.filter(k => k.startsWith('suppliers:'));
};

// Favorites management with caching
export const getFavoriteSuppliers = async (): Promise<string[]> => {
  const cached = await getCache<string[]>(CACHE_KEYS.SUPPLIERS.FAVORITES);
  return cached ?? [];
};

export const addFavoriteSupplier = async (supplierId: string): Promise<void> => {
  const favorites = await getFavoriteSuppliers();
  if (!favorites.includes(supplierId)) {
    const newFavorites = [...favorites, supplierId];
    await setCache(CACHE_KEYS.SUPPLIERS.FAVORITES, newFavorites, {
      ttl: CACHE_TTL.SUPPLIERS.FAVORITES,
      persistent: true,
    });
  }
};

export const removeFavoriteSupplier = async (supplierId: string): Promise<void> => {
  const favorites = await getFavoriteSuppliers();
  const newFavorites = favorites.filter(id => id !== supplierId);
  await setCache(CACHE_KEYS.SUPPLIERS.FAVORITES, newFavorites, {
    ttl: CACHE_TTL.SUPPLIERS.FAVORITES,
    persistent: true,
  });
};

export const isFavoriteSupplier = async (supplierId: string): Promise<boolean> => {
  const favorites = await getFavoriteSuppliers();
  return favorites.includes(supplierId);
};
