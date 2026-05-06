/**
 * Core Cache Operations - Get, Set, Remove
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    CacheEntry,
    CacheOptions,
    DEFAULT_OPTIONS,
    isValidEntry,
    memoryCache,
} from './cacheConfig';

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
 * Remove item from cache
 */
export async function removeCache(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn(`Cache remove failed for key: ${key}`, error);
  }
}

/**
 * Clear all cache or filter by pattern
 */
export async function clearCache(pattern?: string): Promise<void> {
  if (!pattern) {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  } else {
    // Clear only matching keys
    const keys = await AsyncStorage.getAllKeys();
    const matchingKeys = keys.filter((key) => key.includes(pattern));
    for (const key of matchingKeys) {
      memoryCache.delete(key);
    }
    try {
      await AsyncStorage.multiRemove(matchingKeys);
    } catch (error) {
      console.warn('Cache clear with pattern failed:', error);
    }
  }
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
