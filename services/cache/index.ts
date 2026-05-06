/**
 * Cache Service Index - Modular cache system
 * 
 * Split into:
 * - cacheConfig.ts: Constants, keys, TTL, types
 * - cacheCore.ts: Basic get, set, remove operations
 * - cacheBatch.ts: Batch operations and stats
 * - cacheFetch.ts: Smart fetching with getOrFetch
 */

// Configuration
export {
    CACHE_KEYS,
    CACHE_TTL, DEFAULT_OPTIONS, hashString, isValidEntry, memoryCache
} from './cacheConfig';

// Core operations
export {
    clearCache, getCache, getCacheMeta, hasCache, removeCache, setCache
} from './cacheCore';

// Batch operations
export {
    batchGetCache,
    batchSetCache, getCacheKeys,
    getCacheStats, prefetchCache
} from './cacheBatch';

// Fetch utilities
export {
    fetchIfStale, fetchWithRetry, getOrFetch, prefetchSingle
} from './cacheFetch';

// Types
export type { CacheEntry, CacheOptions } from './cacheConfig';

