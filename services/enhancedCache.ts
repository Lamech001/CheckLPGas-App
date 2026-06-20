/**
 * Enhanced Cache Service - Dual-layer caching (Memory + AsyncStorage)
 * Provides ultra-fast in-memory cache with persistent AsyncStorage backup
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Memory cache store
const memoryCache = new Map<string, CacheEntry<any>>();

// Cache keys with namespaces for better organization
export const CACHE_KEYS = {
  // Auth namespace
  AUTH: {
    USER: 'auth:user',
    USER_ROLE: 'auth:user_role',
    TOKEN: 'auth:token',
    SESSION: 'auth:session',
    PERMISSIONS: 'auth:permissions',
  },
  // Suppliers namespace
  SUPPLIERS: {
    LIST: 'suppliers:list',
    DETAIL: (id: string) => `suppliers:detail:${id}`,
    NEARBY: (lat: number, lng: number, radius: number) => 
      `suppliers:nearby:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`,
    PRICES: (id: string) => `suppliers:prices:${id}`,
    FAVORITES: 'suppliers:favorites',
  },
  // User namespace
  USER: {
    PROFILE: 'user:profile',
    LOCATION: 'user:location',
    SETTINGS: 'user:settings',
    PREFERENCES: 'user:preferences',
    SEARCH_HISTORY: 'user:search_history',
    NOTIFICATIONS: 'user:notifications',
  },
  // App namespace
  APP: {
    CONFIG: 'app:config',
    VERSION: 'app:version',
    FEATURES: 'app:features',
    LAST_SYNC: 'app:last_sync',
  },
  // API namespace
  API: {
    RESPONSE: (endpoint: string, params?: string) => 
      `api:${endpoint}${params ? `:${params}` : ''}`,
  },
  // Image namespace
  IMAGES: {
    METADATA: (url: string) => `images:meta:${hashString(url)}`,
    PATH: (url: string) => `images:path:${hashString(url)}`,
  },
} as const;

// TTL Configuration (in milliseconds)
export const CACHE_TTL = {
  // Auth - shorter TTL for security
  AUTH: {
    USER: 5 * 60 * 1000,        // 5 minutes
    USER_ROLE: 10 * 60 * 1000,  // 10 minutes
    TOKEN: 30 * 60 * 1000,      // 30 minutes
    SESSION: 60 * 60 * 1000,    // 1 hour
    PERMISSIONS: 15 * 60 * 1000, // 15 minutes
  },
  // Suppliers - 30 minute TTL to reduce frequent updates
  SUPPLIERS: {
    LIST: 30 * 60 * 1000,       // 30 minutes
    DETAIL: 30 * 60 * 1000,     // 30 minutes
    NEARBY: 30 * 60 * 1000,     // 30 minutes
    PRICES: 30 * 60 * 1000,     // 30 minutes
    FAVORITES: 30 * 60 * 1000,  // 30 minutes
  },
  // User
  USER: {
    PROFILE: 60 * 60 * 1000,    // 1 hour
    LOCATION: 30 * 60 * 1000,    // 30 minutes
    SETTINGS: 24 * 60 * 60 * 1000, // 24 hours
    PREFERENCES: 24 * 60 * 60 * 1000,
    SEARCH_HISTORY: 7 * 24 * 60 * 60 * 1000, // 7 days
    NOTIFICATIONS: 5 * 60 * 1000, // 5 minutes
  },
  // App
  APP: {
    CONFIG: 24 * 60 * 60 * 1000, // 24 hours
    VERSION: Infinity,           // Never expire
    FEATURES: 60 * 60 * 1000,     // 1 hour
    LAST_SYNC: Infinity,
  },
  // API
  API: {
    DEFAULT: 5 * 60 * 1000,     // 5 minutes
    LONG: 60 * 60 * 1000,        // 1 hour
    SHORT: 60 * 1000,            // 1 minute
  },
  // Images
  IMAGES: {
    METADATA: 7 * 24 * 60 * 60 * 1000, // 7 days
    PATH: 7 * 24 * 60 * 60 * 1000,
  },
} as const;

// Simple hash function for URLs
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  ttl: number;
  source: 'memory' | 'storage';
}

export interface CacheOptions {
  ttl?: number;
  version?: string;
  persistent?: boolean; // Save to AsyncStorage
  priority?: 'memory' | 'storage' | 'both';
  maxAge?: number; // Allow stale data when needed
}

const DEFAULT_OPTIONS: CacheOptions = {
  ttl: CACHE_TTL.API.DEFAULT,
  version: '1.0',
  persistent: true,
  priority: 'both',
};

/**
 * Save data to cache (memory + optionally AsyncStorage)
 */
export async function setCache<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    version: opts.version!,
    ttl: opts.ttl!,
    source: 'memory',
  };

  // Always save to memory for fast access
  if (opts.priority === 'memory' || opts.priority === 'both') {
    memoryCache.set(key, entry);
  }

  // Save to AsyncStorage for persistence
  if (opts.persistent && (opts.priority === 'storage' || opts.priority === 'both')) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn(`Cache save failed for key: ${key}`, error);
    }
  }
}

/**
 * Get data from cache (checks memory first, then AsyncStorage)
 */
export async function getCache<T>(
  key: string,
  options: { version?: string; maxAge?: number } = {}
): Promise<T | null> {
  const { version = '1.0', maxAge } = options;

  // Check memory cache first (fastest)
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry) {
    if (isValidEntry(memoryEntry, version, maxAge)) {
      return memoryEntry.data;
    }
    // Remove invalid entry from memory
    memoryCache.delete(key);
  }

  // Check AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const entry: CacheEntry<T> = JSON.parse(stored);
      if (isValidEntry(entry, version, maxAge)) {
        // Restore to memory cache for faster future access
        memoryCache.set(key, { ...entry, source: 'memory' });
        return entry.data;
      }
      // Clean up expired entry
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    console.warn(`Cache read failed for key: ${key}`, error);
  }

  return null;
}

/**
 * Check if cache entry is valid
 */
function isValidEntry<T>(
  entry: CacheEntry<T>,
  version: string,
  maxAge?: number
): boolean {
  // Version mismatch
  if (entry.version !== version) {
    return false;
  }

  // Check expiration
  const age = Date.now() - entry.timestamp;
  const ttl = maxAge ?? entry.ttl;
  
  if (ttl !== Infinity && age > ttl) {
    return false;
  }

  return true;
}

/**
 * Check if cache exists and is valid
 */
export async function hasCache(
  key: string,
  options: { version?: string; maxAge?: number } = {}
): Promise<boolean> {
  const data = await getCache(key, options);
  return data !== null;
}

/**
 * Get cache metadata without full data
 */
export async function getCacheMeta(
  key: string
): Promise<{ timestamp: number; age: number; version: string } | null> {
  // Check memory first
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry) {
    return {
      timestamp: memoryEntry.timestamp,
      age: Date.now() - memoryEntry.timestamp,
      version: memoryEntry.version,
    };
  }

  // Check storage
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const entry: CacheEntry<unknown> = JSON.parse(stored);
      return {
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp,
        version: entry.version,
      };
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Remove item from cache
 */
export async function removeCache(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn(`Cache removal failed for key: ${key}`, error);
  }
}

/**
 * Clear all cache or by pattern
 */
export async function clearCache(pattern?: string): Promise<void> {
  if (!pattern) {
    // Clear everything
    memoryCache.clear();
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => 
      Object.values(CACHE_KEYS).some(namespace => {
        if (typeof namespace === 'object') {
          return Object.values(namespace).some(v => 
            typeof v === 'string' && k.startsWith(v.split(':')[0])
          );
        }
        return false;
      })
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } else {
    // Clear by pattern
    const keys = await AsyncStorage.getAllKeys();
    const matchingKeys = keys.filter(k => k.includes(pattern));
    
    for (const key of matchingKeys) {
      memoryCache.delete(key);
    }
    await AsyncStorage.multiRemove(matchingKeys);
  }
}

/**
 * Get all cache keys
 */
export async function getCacheKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter(k => 
    k.includes(':') && !k.startsWith('RCTAsyncStorage')
  );
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  memoryEntries: number;
  storageEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}> {
  const keys = await getCacheKeys();
  let totalSize = 0;
  let oldestEntry: number | null = null;
  let newestEntry: number | null = null;

  for (const key of keys) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
        const entry: CacheEntry<unknown> = JSON.parse(value);
        
        if (!oldestEntry || entry.timestamp < oldestEntry) {
          oldestEntry = entry.timestamp;
        }
        if (!newestEntry || entry.timestamp > newestEntry) {
          newestEntry = entry.timestamp;
        }
      }
    } catch {
      // Skip invalid entries
    }
  }

  return {
    memoryEntries: memoryCache.size,
    storageEntries: keys.length,
    totalSize,
    oldestEntry,
    newestEntry,
  };
}

/**
 * Prefetch data into cache
 */
export async function prefetchCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<void> {
  try {
    const data = await fetchFn();
    await setCache(key, data, options);
  } catch (error) {
    console.warn(`Prefetch failed for key: ${key}`, error);
  }
}

/**
 * Get or fetch data (stale-while-revalidate pattern)
 */
export async function getOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions & { 
    backgroundRefresh?: boolean;
    onBackgroundUpdate?: (data: T) => void;
  } = {}
): Promise<{ data: T; fromCache: boolean; stale: boolean }> {
  const cached = await getCache<T>(key, { version: options.version, maxAge: options.maxAge });
  
  if (cached !== null) {
    // Check if stale
    const meta = await getCacheMeta(key);
    const ttl = options.ttl ?? CACHE_TTL.API.DEFAULT;
    const isStale = meta ? (Date.now() - meta.timestamp) > ttl * 0.8 : false;
    
    // Background refresh if enabled and stale
    if (options.backgroundRefresh && isStale) {
      fetchFn()
        .then(data => {
          setCache(key, data, options);
          options.onBackgroundUpdate?.(data);
        })
        .catch(() => {}); // Silently fail background refresh
    }
    
    return { data: cached, fromCache: true, stale: isStale };
  }

  // No cache, fetch fresh data
  const fresh = await fetchFn();
  await setCache(key, fresh, options);
  return { data: fresh, fromCache: false, stale: false };
}

/**
 * Batch operations for efficiency
 */
export async function batchSetCache<T>(
  entries: { key: string; data: T; options?: CacheOptions }[]
): Promise<void> {
  const storageOps: [string, string][] = [];
  
  for (const { key, data, options = {} } of entries) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: opts.version!,
      ttl: opts.ttl!,
      source: 'memory',
    };
    
    if (opts.priority === 'memory' || opts.priority === 'both') {
      memoryCache.set(key, entry);
    }
    
    if (opts.persistent && (opts.priority === 'storage' || opts.priority === 'both')) {
      storageOps.push([key, JSON.stringify(entry)]);
    }
  }
  
  if (storageOps.length > 0) {
    try {
      await AsyncStorage.multiSet(storageOps);
    } catch (error) {
      console.warn('Batch cache save failed', error);
    }
  }
}

export async function batchGetCache<T>(
  keys: string[],
  options: { version?: string } = {}
): Promise<Map<string, T | null>> {
  const results = new Map<string, T | null>();
  
  // Check memory first
  const storageKeys: string[] = [];
  for (const key of keys) {
    const memoryEntry = memoryCache.get(key);
    if (memoryEntry && isValidEntry(memoryEntry, options.version || '1.0')) {
      results.set(key, memoryEntry.data);
    } else {
      storageKeys.push(key);
    }
  }
  
  // Batch read from storage
  if (storageKeys.length > 0) {
    try {
      const pairs = await AsyncStorage.multiGet(storageKeys);
      for (const [key, value] of pairs) {
        if (value) {
          try {
            const entry: CacheEntry<T> = JSON.parse(value);
            if (isValidEntry(entry, options.version || '1.0')) {
              results.set(key, entry.data);
              memoryCache.set(key, { ...entry, source: 'memory' });
            } else {
              results.set(key, null);
            }
          } catch {
            results.set(key, null);
          }
        } else {
          results.set(key, null);
        }
      }
    } catch (error) {
      console.warn('Batch cache read failed', error);
      for (const key of storageKeys) {
        results.set(key, null);
      }
    }
  }
  
  return results;
}

// Export memory cache for direct access (use with caution)
export const getMemoryCacheSize = (): number => memoryCache.size;
export const clearMemoryCache = (): void => memoryCache.clear();
