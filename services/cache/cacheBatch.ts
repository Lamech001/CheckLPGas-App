/**
 * Batch Cache Operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheEntry, CacheOptions, memoryCache } from './cacheConfig';
import { getCache } from './cacheCore';

/**
 * Batch get multiple cache entries
 */
export async function batchGetCache<T>(
  keys: string[],
  options: { version?: string } = {}
): Promise<Map<string, T | null>> {
  const results = new Map<string, T | null>();

  // Check memory cache first
  const memoryMisses: string[] = [];
  for (const key of keys) {
    const memoryEntry = memoryCache.get(key);
    if (memoryEntry && memoryEntry.version === options.version) {
      results.set(key, memoryEntry.data);
    } else {
      memoryMisses.push(key);
    }
  }

  // Batch read from AsyncStorage for misses
  if (memoryMisses.length > 0) {
    try {
      const stored = await AsyncStorage.multiGet(memoryMisses);
      for (const [key, value] of stored) {
        if (value) {
          const entry: CacheEntry<T> = JSON.parse(value);
          if (entry.version === options.version) {
            results.set(key, entry.data);
            memoryCache.set(key, { ...entry, source: 'memory' });
          } else {
            results.set(key, null);
          }
        } else {
          results.set(key, null);
        }
      }
    } catch (error) {
      console.warn('Batch cache read failed:', error);
      for (const key of memoryMisses) {
        results.set(key, null);
      }
    }
  }

  return results;
}

/**
 * Batch set multiple cache entries
 */
export async function batchSetCache<T>(
  entries: { key: string; data: T; options?: CacheOptions }[]
): Promise<void> {
  const memoryEntries: [string, CacheEntry<T>][] = [];
  const storageEntries: [string, string][] = [];

  for (const { key, data, options = {} } of entries) {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: options.version ?? '1.0',
      ttl: options.ttl ?? 5 * 60 * 1000,
      source: 'memory',
    };

    memoryEntries.push([key, entry]);

    if (options.persistent !== false) {
      storageEntries.push([key, JSON.stringify(entry)]);
    }
  }

  // Update memory cache
  for (const [key, entry] of memoryEntries) {
    memoryCache.set(key, entry);
  }

  // Update AsyncStorage
  if (storageEntries.length > 0) {
    try {
      await AsyncStorage.multiSet(storageEntries);
    } catch (error) {
      console.warn('Batch cache save failed:', error);
    }
  }
}

/**
 * Prefetch cache entries in background
 */
export async function prefetchCache<T>(
  items: { key: string; fetcher: () => Promise<T>; options?: CacheOptions }[]
): Promise<void> {
  await Promise.all(
    items.map(async ({ key, fetcher, options }) => {
      try {
        // Check if already cached
        const cached = await getCache<T>(key, { version: options?.version });
        if (cached) return;

        // Fetch and cache
        const data = await fetcher();
        const { setCache } = await import('./cacheCore');
        await setCache(key, data, options);
      } catch (error) {
        console.warn(`Prefetch failed for key: ${key}`, error);
      }
    })
  );
}

/**
 * Get all cache keys matching a pattern
 */
export async function getCacheKeys(pattern?: string): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    if (!pattern) return [...keys];
    return [...keys].filter(key => key.includes(pattern));
  } catch (error) {
    console.warn('Failed to get cache keys:', error);
    return [];
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  memoryEntries: number;
  storageEntries: number;
  totalSize: number;
}> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const storageData = await AsyncStorage.multiGet(keys);

    let totalSize = 0;
    for (const [, value] of storageData) {
      if (value) {
        totalSize += new Blob([value]).size;
      }
    }

    return {
      totalEntries: memoryCache.size + keys.length,
      memoryEntries: memoryCache.size,
      storageEntries: keys.length,
      totalSize,
    };
  } catch (error) {
    console.warn('Failed to get cache stats:', error);
    return {
      totalEntries: memoryCache.size,
      memoryEntries: memoryCache.size,
      storageEntries: 0,
      totalSize: 0,
    };
  }
}
