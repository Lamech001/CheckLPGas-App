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
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { CylinderSize, SupplierData, SupplierWithDistance } from './types/supplier';

// Re-export types
export { CylinderSize, SupplierData, SupplierWithDistance };

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
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
      const suppliersQuery = query(
        collection(db, 'suppliers'),
        where('isOpen', '==', true)
      );
      const querySnapshot = await getDocs(suppliersQuery);
      console.log('[Suppliers] Found', querySnapshot.docs.length, 'open suppliers in Firestore');
      
      const suppliers = querySnapshot.docs
        .map((doc) => {
          const data = doc.data() as SupplierData;
          
          // Debug: Check if location exists
          if (!data.location || !data.location.latitude || !data.location.longitude) {
            console.warn('[Suppliers] Missing location for supplier:', data.uid);
            return null;
          }
          
          const distance = calculateDistance(
            userLat,
            userLon,
            data.location.latitude,
            data.location.longitude
          );
          return { data, distance };
        })
        .filter((item): item is { data: SupplierData; distance: number } => item !== null)
        .filter(({ data, distance }) => {
          const isWithinRadius = distance <= effectiveRadiusKm;
          if (!isWithinRadius) {
            console.log('[Suppliers] Supplier', data.uid, 'outside radius. Distance:', distance.toFixed(2), 'km, max:', effectiveRadiusKm, 'km');
          }
          return isWithinRadius;
        })
        .map(({ data, distance }) => ({ ...data, distance }))
        .sort((a, b) => a.distance - b.distance);

      console.log('[Suppliers] Returning', suppliers.length, 'suppliers within', effectiveRadiusKm, 'km');
      return suppliers;
    },
    {
      ttl: CACHE_TTL.SUPPLIERS.NEARBY,
      version: '1.0',
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
  return getCache<SupplierWithDistance[]>(cacheKey, { version: '1.0', maxAge: Infinity });
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
      version: '1.0',
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
  const cachedResults = await batchGetCache<SupplierData>(cacheKeys, { version: '1.0' });
  
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
        options: { ttl: CACHE_TTL.SUPPLIERS.DETAIL, version: '1.0' } as CacheOptions,
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
  getCache<SupplierWithDistance[]>(cacheKey, { version: '1.0' }).then(cached => {
    if (cached && !initialCallbackFired) {
      callback(cached, true);
    }
  });

  // Set up real-time listener
  const suppliersQuery = query(
    collection(db, 'suppliers'),
    where('isOpen', '==', true)
  );
  
  return onSnapshot(
    suppliersQuery,
    (snapshot) => {
      initialCallbackFired = true;
      console.log('[Suppliers] Real-time listener: Found', snapshot.docs.length, 'open suppliers');
      
      const suppliers = snapshot.docs
        .map((doc) => {
          const data = doc.data() as SupplierData;
          
          // Debug: Check if location exists
          if (!data.location || !data.location.latitude || !data.location.longitude) {
            console.warn('[Suppliers] Missing location for supplier:', data.uid);
            return null;
          }
          
          const distance = calculateDistance(
            userLat,
            userLon,
            data.location.latitude,
            data.location.longitude
          );
          return { data, distance };
        })
        .filter((item): item is { data: SupplierData; distance: number } => item !== null)
        .filter(({ data, distance }) => distance <= effectiveRadiusKm)
        .map(({ data, distance }) => ({ ...data, distance }))
        .sort((a, b) => a.distance - b.distance);

      console.log('[Suppliers] Real-time: Returning', suppliers.length, 'suppliers within range');

      // Update cache with fresh data
      setCache(cacheKey, suppliers, {
        ttl: CACHE_TTL.SUPPLIERS.NEARBY,
        version: '1.0',
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
  getCache<SupplierData>(cacheKey, { version: '1.0' }).then(cached => {
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
          version: '1.0',
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
      const suppliersQuery = query(
        collection(db, 'suppliers'),
        where('isOpen', '==', true)
      );
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
        .filter((s) => s.distance <= effectiveRadiusKm)
        .sort((a, b) => a.distance - b.distance);
    },
    {
      ttl: CACHE_TTL.SUPPLIERS.NEARBY,
      version: '1.0',
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
        version: '1.0',
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
  const cached = await getCache<string[]>(CACHE_KEYS.SUPPLIERS.FAVORITES, { version: '1.0' });
  return cached ?? [];
};

export const addFavoriteSupplier = async (supplierId: string): Promise<void> => {
  const favorites = await getFavoriteSuppliers();
  if (!favorites.includes(supplierId)) {
    const newFavorites = [...favorites, supplierId];
    await setCache(CACHE_KEYS.SUPPLIERS.FAVORITES, newFavorites, {
      ttl: CACHE_TTL.SUPPLIERS.FAVORITES,
      version: '1.0',
      persistent: true,
    });
  }
};

export const removeFavoriteSupplier = async (supplierId: string): Promise<void> => {
  const favorites = await getFavoriteSuppliers();
  const newFavorites = favorites.filter(id => id !== supplierId);
  await setCache(CACHE_KEYS.SUPPLIERS.FAVORITES, newFavorites, {
    ttl: CACHE_TTL.SUPPLIERS.FAVORITES,
    version: '1.0',
    persistent: true,
  });
};

export const isFavoriteSupplier = async (supplierId: string): Promise<boolean> => {
  const favorites = await getFavoriteSuppliers();
  return favorites.includes(supplierId);
};
