/**
 * Cache Service - Provides multi-layer caching for faster app performance
 * Uses AsyncStorage for persistence with TTL (Time To Live) support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys
export const CACHE_KEYS = {
  SUPPLIERS: 'cache_suppliers',
  USER_PROFILE: 'cache_user_profile',
  USER_LOCATION: 'cache_user_location',
  SETTINGS: 'cache_settings',
  LAST_UPDATE: 'cache_last_update',
  FAVORITE_SUPPLIERS: 'cache_favorite_suppliers',
  SEARCH_HISTORY: 'cache_search_history',
  APP_VERSION: 'cache_app_version',
} as const;

// Cache TTL in milliseconds. Supplier data is kept in local storage for offline-first use
// and only refreshed when Firestore updates are detected.
const DEFAULT_TTL = {
  SUPPLIERS: Number.POSITIVE_INFINITY,
  USER_PROFILE: 60 * 60 * 1000,  // 1 hour
  USER_LOCATION: 30 * 60 * 1000, // 30 minutes
  SETTINGS: 24 * 60 * 60 * 1000, // 24 hours
  SEARCH_HISTORY: 7 * 24 * 60 * 60 * 1000, // 7 days
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

/**
 * Save data to cache with timestamp
 */
export const saveToCache = async <T>(
  key: string,
  data: T,
  version: string = '1.0'
): Promise<void> => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Silent fail - caching should not break the app
  }
};

/**
 * Get data from cache
 * Returns null if expired or not found
 */
export const getFromCache = async <T>(
  key: string,
  ttl: number = DEFAULT_TTL.SUPPLIERS,
  version: string = '1.0'
): Promise<T | null> => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);

    // Check version mismatch
    if (entry.version !== version) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
};

/**
 * Check if cache is valid (not expired)
 */
export const isCacheValid = async (
  key: string,
  ttl: number = DEFAULT_TTL.SUPPLIERS
): Promise<boolean> => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return false;

    const entry: CacheEntry<unknown> = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;
    return age <= ttl;
  } catch {
    return false;
  }
};

/**
 * Get cache age in milliseconds
 */
export const getCacheAge = async (key: string): Promise<number | null> => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<unknown> = JSON.parse(cached);
    return Date.now() - entry.timestamp;
  } catch {
    return null;
  }
};

/**
 * Clear specific cache entry
 */
export const clearCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Silent fail
  }
};

/**
 * Clear all app cache
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch {
    // Silent fail
  }
};

/**
 * Cache suppliers data
 */
export const cacheSuppliers = async <T>(suppliers: T[]): Promise<void> => {
  await saveToCache(CACHE_KEYS.SUPPLIERS, suppliers, '1.0');
  await saveToCache(CACHE_KEYS.LAST_UPDATE, Date.now(), '1.0');
};

/**
 * Get cached suppliers
 */
export const getCachedSuppliers = async <T>(): Promise<T[] | null> => {
  return await getFromCache<T[]>(CACHE_KEYS.SUPPLIERS, DEFAULT_TTL.SUPPLIERS);
};

/**
 * Cache user profile
 */
export const cacheUserProfile = async <T>(profile: T): Promise<void> => {
  await saveToCache(CACHE_KEYS.USER_PROFILE, profile, '1.0');
};

/**
 * Get cached user profile
 */
export const getCachedUserProfile = async <T>(): Promise<T | null> => {
  return await getFromCache<T>(CACHE_KEYS.USER_PROFILE, DEFAULT_TTL.USER_PROFILE);
};

/**
 * Cache user location
 */
export const cacheUserLocation = async <T>(location: T): Promise<void> => {
  await saveToCache(CACHE_KEYS.USER_LOCATION, location, '1.0');
};

/**
 * Get cached user location
 */
export const getCachedUserLocation = async <T>(): Promise<T | null> => {
  return await getFromCache<T>(CACHE_KEYS.USER_LOCATION, DEFAULT_TTL.USER_LOCATION);
};

/**
 * Cache settings
 */
export const cacheSettings = async <T>(settings: T): Promise<void> => {
  await saveToCache(CACHE_KEYS.SETTINGS, settings, '1.0');
};

/**
 * Get cached settings
 */
export const getCachedSettings = async <T>(): Promise<T | null> => {
  return await getFromCache<T>(CACHE_KEYS.SETTINGS, DEFAULT_TTL.SETTINGS);
};

/**
 * Add to search history
 */
export const addSearchHistory = async (query: string): Promise<void> => {
  try {
    const history = await getFromCache<string[]>(
      CACHE_KEYS.SEARCH_HISTORY,
      DEFAULT_TTL.SEARCH_HISTORY
    ) || [];
    
    // Add to front, remove duplicates, limit to 10
    const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 10);
    await saveToCache(CACHE_KEYS.SEARCH_HISTORY, newHistory, '1.0');
  } catch {
    // Silent fail
  }
};

/**
 * Get search history
 */
export const getSearchHistory = async (): Promise<string[]> => {
  return await getFromCache<string[]>(
    CACHE_KEYS.SEARCH_HISTORY,
    DEFAULT_TTL.SEARCH_HISTORY
  ) || [];
};

/**
 * Clear search history
 */
export const clearSearchHistory = async (): Promise<void> => {
  await clearCache(CACHE_KEYS.SEARCH_HISTORY);
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  totalEntries: number;
  entries: { key: string; age: number; size: number }[];
}> => {
  const entries: { key: string; age: number; size: number }[] = [];
  
  for (const key of Object.values(CACHE_KEYS)) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        const entry: CacheEntry<unknown> = JSON.parse(value);
        entries.push({
          key,
          age: Date.now() - entry.timestamp,
          size: value.length,
        });
      }
    } catch {
      // Skip invalid entries
    }
  }
  
  return {
    totalEntries: entries.length,
    entries,
  };
};
