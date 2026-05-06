/**
 * Cache Fetch Utilities - getOrFetch and smart fetching
 */

import { prefetchCache } from './cacheBatch';
import { CacheOptions, DEFAULT_OPTIONS, isValidEntry, memoryCache } from './cacheConfig';
import { getCache, setCache } from './cacheCore';

interface FetchResult<T> {
  data: T;
  fromCache: boolean;
  stale: boolean;
}

/**
 * Smart fetch with cache-first strategy
 * Returns cached data immediately if available, then fetches fresh data in background
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & { backgroundRefresh?: boolean } = {}
): Promise<FetchResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { backgroundRefresh = false } = opts;

  // Try to get from cache
  const cached = await getCache<T>(key, { version: opts.version });

  if (cached) {
    // Check if cache is stale
    const entry = memoryCache.get(key);
    const isStale = entry ? !isValidEntry(entry, opts.version!, opts.ttl! * 0.8) : false;

    if (!isStale) {
      // Return cached data if fresh
      return { data: cached, fromCache: true, stale: false };
    }

    // Cache is stale - return cached data but refresh in background
    if (backgroundRefresh) {
      fetcher()
        .then((freshData) =>
          setCache(key, freshData, {
            ...opts,
            persistent: true,
          })
        )
        .catch(() => {});
    }

    return { data: cached, fromCache: true, stale: true };
  }

  // No cache - must fetch
  try {
    const data = await fetcher();
    await setCache(key, data, opts);
    return { data, fromCache: false, stale: false };
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}

/**
 * Prefetch single item (compatibility with old API)
 */
export async function prefetchSingle<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<void> {
  await prefetchCache([{ key, fetcher, options }]);
}

/**
 * Fetch only if cache is stale or doesn't exist
 */
export async function fetchIfStale<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check cache
  const cached = await getCache<T>(key, { version: opts.version });

  if (cached) {
    // Check if stale
    const entry = memoryCache.get(key);
    const isStale = entry ? !isValidEntry(entry, opts.version!, opts.ttl) : false;

    if (!isStale) {
      return cached;
    }
  }

  // Fetch fresh data
  const data = await fetcher();
  await setCache(key, data, opts);
  return data;
}
