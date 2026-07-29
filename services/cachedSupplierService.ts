/**
 * Cached Supplier Service - Supplier operations with intelligent caching
 * Features: geo-caching, background refresh, batch operations, real-time sync
 */

import { db } from "@/config/firebase";
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
} from "@/services/enhancedCache";
import { getGeoBounds } from "@/utils/geohashUtils";
import { isOnline } from "@/utils/networkUtils";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  CylinderSize,
  SupplierData,
  SupplierWithDistance,
} from "./types/supplier";

// Type aliases for Firebase types that may not be properly exported
type FirestoreQueryDocumentSnapshot = any;
type FirestoreQuerySnapshot = any;

// Re-export types
export { CylinderSize, SupplierData, SupplierWithDistance };

// Calculate distance between two coordinates using Haversine formula
// Optimized version with cached calculations for performance
const distanceCache = new Map<string, number>();

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  // Null-safety: guard against undefined/null/non-number values
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number" ||
    !isFinite(lat1) ||
    !isFinite(lon1) ||
    !isFinite(lat2) ||
    !isFinite(lon2)
  ) {
    return Infinity; // Return max distance for invalid coordinates
  }
  // Create cache key with 4 decimal precision (≈11m accuracy)
  const cacheKey = `${lat1.toFixed(4)},${lon1.toFixed(4)},${lat2.toFixed(4)},${lon2.toFixed(4)}`;
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey)!;
  }
  const R = 6371; // Earth's radius in kilometers (mean radius)
  const toRad = (value: number) => value * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  // Cache the result (limit cache size to prevent memory issues)
  if (distanceCache.size > 1000) {
    const firstKey = distanceCache.keys().next().value;
    if (firstKey) {
      distanceCache.delete(firstKey);
    }
  }
  distanceCache.set(cacheKey, distance);
  return distance;
};

// Maximum nearby radius should come from the caller/UI.
// Previously this was clamped to 1km which made distance/nearby results appear incorrect.
// If you still want a hard cap for performance, set it explicitly from app settings.
const MAX_NEARBY_RADIUS_KM = Number.POSITIVE_INFINITY;

// Generate cache key for location-based queries
const generateNearbyCacheKey = (
  lat: number,
  lng: number,
  radiusKm: number,
): string => {
  const effectiveRadiusKm = Math.min(radiusKm, MAX_NEARBY_RADIUS_KM);
  // Round coordinates to reduce cache fragmentation (4 decimal places = ~11m precision)
  const roundedLat = Math.round(lat * 10000) / 10000;
  const roundedLng = Math.round(lng * 10000) / 10000;
  return CACHE_KEYS.SUPPLIERS.NEARBY(roundedLat, roundedLng, effectiveRadiusKm);
};

/**
 * Fetch open suppliers within radius with caching
 * Implements offline-first pattern: returns cached data when offline, fetches fresh when online
 */
export const getSuppliersWithinRadius = async (
  userLat: number,
  userLon: number,
  radiusKm: number = MAX_NEARBY_RADIUS_KM,
  forceRefresh: boolean = false,
): Promise<SupplierWithDistance[]> => {
  const effectiveRadiusKm = radiusKm;
  const cacheKey = generateNearbyCacheKey(userLat, userLon, effectiveRadiusKm);
  const online = await isOnline();

  // If offline and not forcing refresh, return cached data only
  if (!online && !forceRefresh) {
    const cached = await getCache<SupplierWithDistance[]>(cacheKey, {
      maxAge: Infinity,
    });
    if (cached) {
      return cached;
    }
    // No cached data available, return empty array
    return [];
  }

  // Online or forcing refresh - fetch fresh data using geohash bounding box
  const bounds = getGeoBounds(userLat, userLon, effectiveRadiusKm);

  // Use geohash range query to limit results to the bounding box superset,
  // then refine with exact Haversine distance client-side.
  const suppliersQuery = query(
    collection(db, "suppliers"),
    where("geohash", ">=", bounds.minGeohash),
    where("geohash", "<=", bounds.maxGeohash),
    orderBy("geohash", "asc"),
  );

  const querySnapshot = await getDocs(suppliersQuery);

  const suppliers = querySnapshot.docs
    .map((doc: FirestoreQueryDocumentSnapshot) => {
      const data = doc.data() as SupplierData;
      // Null-safety: skip suppliers with missing/invalid location
      if (
        !data.location ||
        typeof data.location.latitude !== "number" ||
        typeof data.location.longitude !== "number"
      ) {
        return { data, distance: Infinity };
      }
      const distance = calculateDistance(
        userLat,
        userLon,
        data.location.latitude,
        data.location.longitude,
      );
      return { data, distance };
    })
    .filter(({ data, distance }: { data: SupplierData; distance: number }) => {
      // Filter by distance
      if (distance > effectiveRadiusKm) return false;
      // Filter by isOpen status (suppliers must explicitly set isOpen = false to be hidden)
      return data.isOpen !== false;
    })
    .map(({ data, distance }: { data: SupplierData; distance: number }) => ({
      ...data,
      distance,
    }))
    .sort(
      (a: SupplierWithDistance, b: SupplierWithDistance) =>
        a.distance - b.distance,
    );

  // Save to cache permanently
  await setCache(cacheKey, suppliers, {
    ttl: CACHE_TTL.SUPPLIERS.NEARBY,
    persistent: true,
  });

  return suppliers;
};

/**
 * Get cached suppliers only (no fetch)
 */
export const getCachedSuppliers = async (
  userLat: number,
  userLon: number,
  radiusKm: number = MAX_NEARBY_RADIUS_KM,
): Promise<SupplierWithDistance[] | null> => {
  const effectiveRadiusKm = radiusKm;
  const cacheKey = generateNearbyCacheKey(userLat, userLon, effectiveRadiusKm);
  return getCache<SupplierWithDistance[]>(cacheKey, { maxAge: Infinity });
};

/**
 * Sync suppliers when coming back online
 * This function should be called when the device comes back online
 */
export const syncSuppliersWhenOnline = async (
  userLat: number,
  userLon: number,
  radiusKm: number = MAX_NEARBY_RADIUS_KM,
): Promise<void> => {
  try {
    const online = await isOnline();
    if (online) {
      // Force refresh when coming back online
      await getSuppliersWithinRadius(userLat, userLon, radiusKm, true);
    }
  } catch (error) {
    console.error("Failed to sync suppliers when online:", error);
  }
};

/**
 * Get supplier by ID with caching
 */
export const getSupplierById = async (
  supplierId: string,
): Promise<SupplierData | null> => {
  const cacheKey = CACHE_KEYS.SUPPLIERS.DETAIL(supplierId);
  return getOrFetch(
    cacheKey,
    async () => {
      const supplierRef = doc(db, "suppliers", supplierId);
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
    },
  ).then((result) => result.data);
};

/**
 * Get multiple suppliers by IDs with batch caching
 */
export const getSuppliersByIds = async (
  supplierIds: string[],
): Promise<Map<string, SupplierData | null>> => {
  const cacheKeys = supplierIds.map((id) => CACHE_KEYS.SUPPLIERS.DETAIL(id));
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
      const supplierRef = doc(db, "suppliers", id);
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
  onError?: (error: Error) => void,
) => {
  const effectiveRadiusKm = radiusKm;
  const cacheKey = generateNearbyCacheKey(userLat, userLon, effectiveRadiusKm);
  let initialCallbackFired = false;

  // Get cached data first for immediate display
  const cachedPromise = getCache<SupplierWithDistance[]>(cacheKey);

  // Consume the cached result for the initial UI paint.
  cachedPromise.then((cached) => {
    if (!initialCallbackFired && cached) {
      callback(cached, true);
    }
  });

  // Set up real-time listener using geohash bounding box
  const bounds = getGeoBounds(userLat, userLon, effectiveRadiusKm);
  const suppliersQuery = query(
    collection(db, "suppliers"),
    where("geohash", ">=", bounds.minGeohash),
    where("geohash", "<=", bounds.maxGeohash),
    orderBy("geohash", "asc"),
  );

  return onSnapshot(
    suppliersQuery,
    (snapshot: FirestoreQuerySnapshot) => {
      initialCallbackFired = true;
      const suppliers = snapshot.docs
        .map((doc: FirestoreQueryDocumentSnapshot) => {
          const data = doc.data() as SupplierData;
          // Null-safety: skip suppliers with missing/invalid location
          if (
            !data.location ||
            typeof data.location.latitude !== "number" ||
            typeof data.location.longitude !== "number"
          ) {
            return { data, distance: Infinity };
          }
          const distance = calculateDistance(
            userLat,
            userLon,
            data.location.latitude,
            data.location.longitude,
          );
          return { data, distance };
        })
        .filter(
          ({ data, distance }: { data: SupplierData; distance: number }) => {
            // Filter by distance
            if (distance > effectiveRadiusKm) return false;
            // Filter by isOpen status (suppliers must explicitly set isOpen = false to be hidden)
            return data.isOpen !== false;
          },
        )
        .map(
          ({ data, distance }: { data: SupplierData; distance: number }) => ({
            ...data,
            distance,
          }),
        )
        .sort(
          (a: SupplierWithDistance, b: SupplierWithDistance) =>
            a.distance - b.distance,
        );

      // Update cache with fresh data
      setCache(cacheKey, suppliers, {
        ttl: CACHE_TTL.SUPPLIERS.NEARBY,
        persistent: true,
      }).catch(() => {});

      callback(suppliers, false);
    },
    (error: Error) => {
      console.error("Supplier subscription error:", error);
      onError?.(error);
    },
  );
};

/**
 * Subscribe to single supplier with caching
 */
export const subscribeToSupplier = (
  supplierId: string,
  callback: (supplier: SupplierData | null, fromCache: boolean) => void,
  onError?: (error: Error) => void,
) => {
  const cacheKey = CACHE_KEYS.SUPPLIERS.DETAIL(supplierId);
  let initialCallbackFired = false;

  // Get cached data first
  getCache<SupplierData>(cacheKey).then((cached) => {
    if (cached && !initialCallbackFired) {
      callback(cached, true);
    }
  });

  // Set up real-time listener
  const supplierRef = doc(db, "suppliers", supplierId);
  return onSnapshot(
    supplierRef,
    (snapshot: FirestoreQuerySnapshot) => {
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
    (error: Error) => {
      console.error("Supplier subscription error:", error);
      onError?.(error);
    },
  );
};

/**
 * Filter suppliers by cylinder size
 * Works on cached or fresh data
 */
export const filterByCylinderSize = (
  suppliers: SupplierWithDistance[],
  size: CylinderSize | "all",
): SupplierWithDistance[] => {
  if (size === "all") return suppliers;
  return suppliers
    .filter((supplier) =>
      supplier.prices.some((price) => price.size === size && price.inStock),
    )
    .sort((a, b) => a.distance - b.distance);
};

/**
 * Cache management for suppliers
 */
export const invalidateSupplierCache = async (
  supplierId?: string,
): Promise<void> => {
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
  radiusKm: number = MAX_NEARBY_RADIUS_KM,
): Promise<void> => {
  const effectiveRadiusKm = Math.min(radiusKm, MAX_NEARBY_RADIUS_KM);
  const cacheKey = generateNearbyCacheKey(lat, lng, effectiveRadiusKm);
  await prefetchCache(
    cacheKey,
    async () => {
      // Fetch suppliers using geohash bounding box, then refine client-side with Haversine distance
      const bounds = getGeoBounds(lat, lng, effectiveRadiusKm);
      const suppliersQuery = query(
        collection(db, "suppliers"),
        where("geohash", ">=", bounds.minGeohash),
        where("geohash", "<=", bounds.maxGeohash),
        orderBy("geohash", "asc"),
      );
      const querySnapshot = await getDocs(suppliersQuery);
      return querySnapshot.docs
        .map((doc: FirestoreQueryDocumentSnapshot) => {
          const data = doc.data() as SupplierData;
          // Null-safety: skip suppliers with missing/invalid location
          if (
            !data.location ||
            typeof data.location.latitude !== "number" ||
            typeof data.location.longitude !== "number"
          ) {
            return { ...data, distance: Infinity } as SupplierWithDistance;
          }
          const distance = calculateDistance(
            lat,
            lng,
            data.location.latitude,
            data.location.longitude,
          );
          return { ...data, distance };
        })
        .filter((s: SupplierWithDistance) => {
          // Filter by distance
          if (s.distance > effectiveRadiusKm) return false;
          // Filter by isOpen status (suppliers must explicitly set isOpen = false to be hidden)
          return s.isOpen !== false;
        })
        .sort(
          (a: SupplierWithDistance, b: SupplierWithDistance) =>
            a.distance - b.distance,
        );
    },
    {
      ttl: CACHE_TTL.SUPPLIERS.NEARBY,
      persistent: true,
    },
  );
};

/**
 * Prefetch multiple suppliers by IDs
 */
export const prefetchSupplierDetails = async (
  supplierIds: string[],
): Promise<void> => {
  const promises = supplierIds.map((id) =>
    prefetchCache(
      CACHE_KEYS.SUPPLIERS.DETAIL(id),
      async () => {
        const supplierRef = doc(db, "suppliers", id);
        const supplierSnap = await getDoc(supplierRef);
        return supplierSnap.exists()
          ? (supplierSnap.data() as SupplierData)
          : null;
      },
      {
        ttl: CACHE_TTL.SUPPLIERS.DETAIL,
        persistent: true,
      },
    ),
  );
  await Promise.all(promises);
};

/**
 * Warm cache for multiple locations
 * Useful for pre-caching data for areas the user frequently visits
 */
export const warmSupplierCache = async (
  locations: { lat: number; lng: number; radiusKm?: number }[],
): Promise<void> => {
  const promises = locations.map((loc) =>
    prefetchSuppliers(loc.lat, loc.lng, loc.radiusKm ?? 1),
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
  const nearbyCount = allKeys.filter((k) => k.includes("nearby")).length;
  const detailCount = allKeys.filter((k) => k.includes("detail")).length;
  const favoriteCount = allKeys.filter((k) => k.includes("favorites")).length;
  // Count total unique suppliers in detail cache
  const supplierIds = new Set(
    allKeys
      .filter((k) => k.includes("detail:"))
      .map((k) => k.split("detail:")[1]),
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
  const { getCacheKeys } = await import("@/services/enhancedCache");
  const allKeys = await getCacheKeys();
  return allKeys.filter((k) => k.startsWith("suppliers:"));
};

// Favorites management with caching
export const getFavoriteSuppliers = async (): Promise<string[]> => {
  const cached = await getCache<string[]>(CACHE_KEYS.SUPPLIERS.FAVORITES);
  return cached ?? [];
};

export const addFavoriteSupplier = async (
  supplierId: string,
): Promise<void> => {
  const favorites = await getFavoriteSuppliers();
  if (!favorites.includes(supplierId)) {
    const newFavorites = [...favorites, supplierId];
    await setCache(CACHE_KEYS.SUPPLIERS.FAVORITES, newFavorites, {
      ttl: CACHE_TTL.SUPPLIERS.FAVORITES,
      persistent: true,
    });
  }
};

export const removeFavoriteSupplier = async (
  supplierId: string,
): Promise<void> => {
  const favorites = await getFavoriteSuppliers();
  const newFavorites = favorites.filter((id) => id !== supplierId);
  await setCache(CACHE_KEYS.SUPPLIERS.FAVORITES, newFavorites, {
    ttl: CACHE_TTL.SUPPLIERS.FAVORITES,
    persistent: true,
  });
};

export const isFavoriteSupplier = async (
  supplierId: string,
): Promise<boolean> => {
  const favorites = await getFavoriteSuppliers();
  return favorites.includes(supplierId);
};
