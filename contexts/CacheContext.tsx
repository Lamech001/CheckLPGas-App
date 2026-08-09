/**
 * Cache Context - Global cache management for the app
 * Provides cache status, batch operations, and cache warming
 */

import {
    CACHE_KEYS,
    CACHE_TTL,
    clearCache,
    getCacheStats,
    prefetchSingle
} from '@/services/cache';
import { warmSupplierCache } from '@/services/cachedSupplierService';
import { evictOldImages, getImageCacheSize, initImageCache } from '@/services/imageCache';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Cache context type
interface CacheContextType {
  // Status
  isInitialized: boolean;
  isWarming: boolean;
  
  // Stats
  memoryEntries: number;
  storageEntries: number;
  totalSize: number;
  imageCacheSize: number;
  
  // Operations
  invalidateCache: (pattern?: string) => Promise<void>;
  invalidateAll: () => Promise<void>;
  refreshStats: () => Promise<void>;
  
  // Prefetching
  prefetchSuppliers: (locations: { lat: number; lng: number; radiusKm?: number }[]) => Promise<void>;
  prefetchImage: (url: string) => Promise<string | null>;
  
  // Cache warming
  warmCache: () => Promise<void>;
  
  // Utility
  isCacheStale: (key: string, maxAge: number) => Promise<boolean>;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

// Cache warming configuration
interface WarmLocation {
  lat: number;
  lng: number;
  radiusKm?: number;
}

const WARM_LOCATIONS: WarmLocation[] = [
  // Default locations for warming (user's common areas)
  // These would typically come from user settings or usage patterns
];

interface CacheProviderProps {
  children: React.ReactNode;
  warmOnMount?: boolean;
  maxCacheAge?: number;
}

export function CacheProvider({ 
  children, 
  warmOnMount = true,
  maxCacheAge = 7 * 24 * 60 * 60 * 1000, // 7 days
}: CacheProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWarming, setIsWarming] = useState(false);
  const [memoryEntries, setMemoryEntries] = useState(0);
  const [storageEntries, setStorageEntries] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [imageCacheSize, setImageCacheSize] = useState(0);
  
  const isMounted = useRef(true);

  // Refresh cache statistics
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getCacheStats();
      const imageSize = await getImageCacheSize();

      if (isMounted.current) {
        setMemoryEntries(stats.memoryEntries);
        setStorageEntries(stats.storageEntries);
        setTotalSize(stats.totalSize);
        setImageCacheSize(imageSize);
      }
    } catch (error) {
      console.error('Failed to refresh cache stats:', error);
    }
  }, []);

  // Warm cache with commonly used data
  const warmCacheInternal = useCallback(async () => {
    if (isWarming || WARM_LOCATIONS.length === 0) return;

    setIsWarming(true);

    try {
      // Warm supplier cache
      await warmSupplierCache(WARM_LOCATIONS);

      // Prefetch app config
      await prefetchSingle(
        CACHE_KEYS.APP.CONFIG,
        async () => ({
          version: '1.0.0',
          features: {},
          lastUpdated: Date.now(),
        }),
        { ttl: CACHE_TTL.APP.CONFIG, version: '1.0', persistent: true }
      );

      await refreshStats();
    } catch (error) {
      console.error('Cache warming error:', error);
    } finally {
      if (isMounted.current) {
        setIsWarming(false);
      }
    }
  }, [isWarming, refreshStats]);

  // Perform cache maintenance
  const performMaintenanceInternal = useCallback(async () => {
    try {
      // Evict old images if needed
      await evictOldImages();
      
      // Refresh stats
      await refreshStats();
    } catch (error) {
      console.error('Cache maintenance error:', error);
    }
  }, [refreshStats]);

  // Initialize cache on mount
  useEffect(() => {
    isMounted.current = true;

    const init = async () => {
      try {
        // Initialize image cache directory
        await initImageCache();
        
        // Load initial stats
        await refreshStats();
        
        if (isMounted.current) {
          setIsInitialized(true);
        }

        // Warm cache if enabled
        if (warmOnMount) {
          warmCacheInternal();
        }

        // Set up periodic cache maintenance
        const maintenanceInterval = setInterval(() => {
          performMaintenanceInternal();
        }, 60 * 60 * 1000); // Every hour

        return () => {
          clearInterval(maintenanceInterval);
        };
      } catch (error) {
        console.error('Cache initialization error:', error);
        if (isMounted.current) {
          setIsInitialized(true); // Still mark as initialized to not block UI
        }
      }
    };

    init();

    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warmOnMount]);

  // Invalidate cache by pattern
  const invalidateCache = useCallback(async (pattern?: string) => {
    try {
      await clearCache(pattern);
      await refreshStats();
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }, [refreshStats]);

  // Invalidate all cache
  const invalidateAll = useCallback(async () => {
    try {
      await clearCache();
      await refreshStats();
    } catch (error) {
      console.error('Failed to invalidate all cache:', error);
    }
  }, [refreshStats]);

  // Check if cache is stale
  const isCacheStale = useCallback(async (key: string, maxAge: number): Promise<boolean> => {
    const { getCacheMeta } = await import('@/services/cache');
    const meta = await getCacheMeta(key);
    if (!meta) return true;
    return (Date.now() - meta.timestamp) > maxAge;
  }, []);

  // Prefetch suppliers
  const prefetchSuppliers = useCallback(async (
    locations: { lat: number; lng: number; radiusKm?: number }[]
  ) => {
    try {
      await warmSupplierCache(locations);
      await refreshStats();
    } catch (error) {
      console.error('Failed to prefetch suppliers:', error);
    }
  }, [refreshStats]);

  // Prefetch single image
  const prefetchImage = useCallback(async (url: string): Promise<string | null> => {
    try {
      const { cacheImage } = await import('@/services/imageCache');
      const cached = await cacheImage(url);
      await refreshStats();
      return cached;
    } catch (error) {
      console.error('Failed to prefetch image:', error);
      return null;
    }
  }, [refreshStats]);

  const value: CacheContextType = {
    isInitialized,
    isWarming,
    memoryEntries,
    storageEntries,
    totalSize,
    imageCacheSize,
    invalidateCache,
    invalidateAll,
    refreshStats,
    prefetchSuppliers,
    prefetchImage,
    warmCache: warmCacheInternal,
    isCacheStale,
  };

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
}

// Hook to use cache context
export function useCache(): CacheContextType {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}

// Hook for cache status (lighter version)
export function useCacheStatus(): {
  isInitialized: boolean;
  totalSize: number;
  entryCount: number;
} {
  const context = useContext(CacheContext);
  if (context === undefined) {
    return { isInitialized: false, totalSize: 0, entryCount: 0 };
  }
  
  return {
    isInitialized: context.isInitialized,
    totalSize: context.totalSize + context.imageCacheSize,
    entryCount: context.memoryEntries + context.storageEntries,
  };
}

// Hook for cache operations only
export function useCacheOperations(): Pick<
  CacheContextType,
  'invalidateCache' | 'invalidateAll' | 'prefetchSuppliers' | 'prefetchImage' | 'warmCache'
> {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error('useCacheOperations must be used within a CacheProvider');
  }

  return {
    invalidateCache: context.invalidateCache,
    invalidateAll: context.invalidateAll,
    prefetchSuppliers: context.prefetchSuppliers,
    prefetchImage: context.prefetchImage,
    warmCache: context.warmCache,
  };
}
