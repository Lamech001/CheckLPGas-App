/**
 * Services Index - Export all services
 */

// Enhanced cache service (core) - now modular
export {
    CACHE_KEYS,
    CACHE_TTL, batchGetCache,
    batchSetCache, clearCache, getCache, getCacheKeys, getCacheMeta, getCacheStats, getOrFetch, hasCache, prefetchCache, removeCache, setCache, type CacheOptions
} from './cache';

// Legacy cache service (for backward compatibility)
export {
    CACHE_KEYS as LEGACY_CACHE_KEYS, addSearchHistory, cacheSettings, cacheSuppliers, cacheUserLocation, cacheUserProfile, clearAllCache, clearCache as clearLegacyCache, clearSearchHistory, getCacheAge, getCachedSettings, getCachedSuppliers, getCachedUserLocation, getCachedUserProfile, getFromCache, getCacheStats as getLegacyCacheStats, getSearchHistory, isCacheValid, saveToCache
} from './cacheService';

// Cached supplier service
export {
    addFavoriteSupplier, calculateDistance, filterByCylinderSize, getCachedSuppliers as getCachedSuppliersList, getFavoriteSuppliers, getSupplierById, getSupplierCacheStats, getSuppliersByIds, getSuppliersWithinRadius, invalidateSupplierCache, isFavoriteSupplier, prefetchSupplierDetails, prefetchSuppliers, removeFavoriteSupplier, subscribeToSupplier, subscribeToSuppliers, warmSupplierCache
} from './cachedSupplierService';

// Image cache service
export {
    batchCacheImages, cacheImage, cacheSupplierLogo, clearImageCache, evictOldImages, getCachedImageUri, getImageCacheSize, getStorageImageUrl, initImageCache, prefetchImages, useCachedImage
} from './imageCache';

// Re-export types
export type { CylinderSize, SupplierData, SupplierWithDistance } from './types/supplier';

