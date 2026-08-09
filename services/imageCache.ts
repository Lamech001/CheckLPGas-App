/**
 * Image Cache Service - Efficient image caching for React Native
 * Features: disk caching, memory cache, prefetching, LRU eviction
 */

import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import { CACHE_KEYS, CACHE_TTL, getCache, getCacheKeys, removeCache, setCache } from './enhancedCache';

// Cache directory for images
const getImageCacheDir = () => {
  // @ts-ignore - cacheDirectory exists at runtime
  const base = FileSystem.cacheDirectory ?? 'file:///cache/';
  return base.endsWith('/') ? base + 'images/' : base + '/images/';
};

// Helper to ensure directory exists
const ensureCacheDir = async (): Promise<string> => {
  const dir = getImageCacheDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
};

// Memory cache for image URIs (prevents duplicate disk reads)
const memoryImageCache = new Map<string, string>();

// Maximum cache size (100MB)
const MAX_CACHE_SIZE = 100 * 1024 * 1024;

interface ImageCacheEntry {
  localUri: string;
  originalUrl: string;
  size: number;
  timestamp: number;
  width?: number;
  height?: number;
  contentType?: string;
}

/**
 * Initialize image cache directory
 */
export const initImageCache = async (): Promise<void> => {
  try {
    await ensureCacheDir();
  } catch (error) {
    console.error('Failed to init image cache:', error);
  }
};

/**
 * Generate cache key from URL
 */
const generateImageCacheKey = (url: string): string => {
  // Simple hash for URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

/**
 * Get file extension from URL or content type
 */
const getFileExtension = (url: string, contentType?: string): string => {
  if (contentType) {
    if (contentType.includes('image/jpeg')) return '.jpg';
    if (contentType.includes('image/png')) return '.png';
    if (contentType.includes('image/webp')) return '.webp';
    if (contentType.includes('image/gif')) return '.gif';
  }
  
  // Extract from URL
  const match = url.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i);
  if (match) {
    return match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`;
  }
  
  return '.jpg'; // Default
};

/**
 * Download and cache an image
 */
export const cacheImage = async (
  url: string,
  options: { 
    maxWidth?: number; 
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<string | null> => {
  if (!url) return null;

  // Check memory cache first
  if (memoryImageCache.has(url)) {
    const cachedUri = memoryImageCache.get(url);
    // Verify file still exists
    if (cachedUri) {
      const info = await FileSystem.getInfoAsync(cachedUri);
      if (info.exists) {
        return cachedUri;
      }
    }
  }

  // Check metadata cache
  const cacheKey = CACHE_KEYS.IMAGES.METADATA(url);
  const cached = await getCache<ImageCacheEntry>(cacheKey, { 
    version: '1.0',
    maxAge: CACHE_TTL.IMAGES.METADATA,
  });

  if (cached) {
    // Verify file exists
    const info = await FileSystem.getInfoAsync(cached.localUri);
    if (info.exists) {
      memoryImageCache.set(url, cached.localUri);
      return cached.localUri;
    }
  }

  // Download image
  try {
    const cacheDir = await ensureCacheDir();

    const cacheKey = generateImageCacheKey(url);
    const extension = getFileExtension(url);
    const localUri = cacheDir + cacheKey + extension;

    // Check if already downloaded
    const existingInfo = await FileSystem.getInfoAsync(localUri);
    if (existingInfo.exists && existingInfo.size > 0) {
      memoryImageCache.set(url, localUri);

      // Update cache metadata
      await setCache(CACHE_KEYS.IMAGES.METADATA(url), {
        localUri,
        originalUrl: url,
        size: existingInfo.size,
        timestamp: Date.now(),
      }, {
        ttl: CACHE_TTL.IMAGES.METADATA,
        version: '1.0',
        persistent: true,
      });

      return localUri;
    }

    // Download to cache
    const downloadResult = await FileSystem.downloadAsync(url, localUri);

    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && info.size > 0) {
      // Save metadata
      await setCache(CACHE_KEYS.IMAGES.METADATA(url), {
        localUri,
        originalUrl: url,
        size: info.size,
        timestamp: Date.now(),
        contentType: downloadResult.mimeType ?? undefined,
      }, {
        ttl: CACHE_TTL.IMAGES.METADATA,
        version: '1.0',
        persistent: true,
      });

      // Add to memory cache
      memoryImageCache.set(url, localUri);

      return localUri;
    }

    return null;
  } catch (error) {
    console.error('Image cache error:', error);
    return null;
  }
};

/**
 * Get cached image URI (returns original URL if not cached)
 */
export const getCachedImageUri = async (url: string): Promise<string> => {
  const cached = await cacheImage(url);
  return cached ?? url;
};

/**
 * Batch cache multiple images
 */
export const batchCacheImages = async (
  urls: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, string | null>> => {
  const results = new Map<string, string | null>();
  
  // Process in chunks to avoid overwhelming the system
  const CHUNK_SIZE = 5;
  
  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    
    const chunkPromises = chunk.map(async (url) => {
      const cached = await cacheImage(url);
      results.set(url, cached);
      return cached;
    });
    
    await Promise.all(chunkPromises);
    
    if (onProgress) {
      onProgress(Math.min(i + CHUNK_SIZE, urls.length), urls.length);
    }
  }
  
  return results;
};

/**
 * Prefetch images (download in background)
 */
export const prefetchImages = async (
  urls: string[],
  priority: 'high' | 'low' = 'low'
): Promise<void> => {
  if (priority === 'low') {
    // Use requestIdleCallback or setTimeout for low priority
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Filter out already cached images
  const uncachedUrls: string[] = [];
  
  for (const url of urls) {
    if (!memoryImageCache.has(url)) {
      const cached = await getCache<ImageCacheEntry>(
        CACHE_KEYS.IMAGES.METADATA(url),
        { version: '1.0' }
      );
      if (!cached) {
        uncachedUrls.push(url);
      }
    }
  }
  
  // Download in background
  await batchCacheImages(uncachedUrls);
};

/**
 * Clear image cache
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    // Clear memory cache
    memoryImageCache.clear();

    // Clear disk cache
    const cacheDir = getImageCacheDir();
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (dirInfo.exists && dirInfo.isDirectory) {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      await Promise.all(
        files.map(file => FileSystem.deleteAsync(cacheDir + file, { idempotent: true }))
      );
    }

    // Clear metadata cache
    const keys = await getCacheKeys();
    const imageKeys = keys.filter(key => key.startsWith('images:'));
    await Promise.all(imageKeys.map(key => removeCache(key)));
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};

/**
 * Get image cache size
 */
export const getImageCacheSize = async (): Promise<number> => {
  try {
    const cacheDir = getImageCacheDir();
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists || !dirInfo.isDirectory) return 0;

    const files = await FileSystem.readDirectoryAsync(cacheDir);
    let totalSize = 0;
    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(cacheDir + file);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        totalSize += fileInfo.size;
      }
    }
    return totalSize;
  } catch {
    return 0;
  }
};

/**
 * Evict old images when cache exceeds max size
 * Uses LRU (Least Recently Used) eviction
 */
export const evictOldImages = async (maxSize: number = MAX_CACHE_SIZE): Promise<void> => {
  try {
    const cacheDir = getImageCacheDir();
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists || !dirInfo.isDirectory) return;

    const fileNames = await FileSystem.readDirectoryAsync(cacheDir);

    // Collect file info
    const fileInfos: { uri: string; size: number; modifiedTime?: number }[] = [];
    for (const fileName of fileNames) {
      const fileUri = cacheDir + fileName;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        fileInfos.push({
          uri: fileUri,
          size: fileInfo.size,
          modifiedTime: fileInfo.modificationTime,
        });
      }
    }

    const totalSize = fileInfos.reduce((sum, info) => sum + info.size, 0);

    if (totalSize > maxSize) {
      // Sort by modification time (oldest first)
      fileInfos.sort((a, b) => (a.modifiedTime ?? 0) - (b.modifiedTime ?? 0));

      let currentSize = totalSize;
      for (const info of fileInfos) {
        if (currentSize <= maxSize) break;

        await FileSystem.deleteAsync(info.uri, { idempotent: true });
        currentSize -= info.size;
      }
    }
  } catch (error) {
    console.error('Cache eviction error:', error);
  }
};

/**
 * Get Firebase Storage download URL with caching
 */
export const getStorageImageUrl = async (
  path: string
): Promise<string> => {
  const cacheKey = `storage:${path}`;
  
  // Check cache
  const cached = await getCache<string>(cacheKey, { 
    version: '1.0',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  
  if (cached) return cached;

  // Get fresh URL from Firebase Storage
  try {
    const { getDownloadURL, ref } = await import('firebase/storage');
    const { storage } = await import('@/config/firebase');
    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);

    // Cache URL
    await setCache(cacheKey, url, {
      ttl: 24 * 60 * 60 * 1000,
      version: '1.0',
      persistent: true,
    });

    return url;
  } catch (error) {
    console.warn('Failed to get storage URL:', error);
    // Return path as-is if we can't get the download URL
    return path;
  }
};

/**
 * Cache supplier logo
 */
export const cacheSupplierLogo = async (
  supplierId: string,
  logoUrl: string
): Promise<string | null> => {
  const cacheKey = `supplier:logo:${supplierId}`;
  
  // Check if already cached
  const cached = await getCache<string>(cacheKey, { version: '1.0' });
  if (cached) {
    const info = await FileSystem.getInfoAsync(cached);
    if (info.exists) return cached;
  }

  // Download and cache
  const localUri = await cacheImage(logoUrl);
  
  if (localUri) {
    await setCache(cacheKey, localUri, {
      ttl: CACHE_TTL.IMAGES.METADATA,
      version: '1.0',
      persistent: true,
    });
  }

  return localUri;
};

/**
 * Hook for cached image (React hook version)
 */
export function useCachedImage(url: string | null | undefined): {
  uri: string | null;
  isLoading: boolean;
} {
  const [uri, setUri] = useState<string | null>(url ?? null);
  const [isLoading, setIsLoading] = useState(!!url);

  useEffect(() => {
    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUri(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    cacheImage(url).then((cachedUri) => {
      if (isMounted) {
        setUri(cachedUri ?? url);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { uri, isLoading };
}
