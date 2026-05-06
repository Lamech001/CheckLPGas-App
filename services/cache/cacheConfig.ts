/**
 * Cache Configuration - Keys and TTL constants
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Memory cache store
export const memoryCache = new Map<string, CacheEntry<any>>();

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
  // Suppliers
  SUPPLIERS: {
    LIST: 5 * 60 * 1000,        // 5 minutes
    DETAIL: 10 * 60 * 1000,     // 10 minutes
    NEARBY: 2 * 60 * 1000,      // 2 minutes (location-based, refresh often)
    PRICES: 3 * 60 * 1000,      // 3 minutes (prices change)
    FAVORITES: 60 * 60 * 1000,  // 1 hour
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
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Default cache options
export const DEFAULT_OPTIONS: CacheOptions = {
  ttl: CACHE_TTL.API.DEFAULT,
  version: '1.0',
  persistent: true,
  priority: 'both',
};

// Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  ttl: number;
  source: 'memory' | 'storage';
}

export interface CacheOptions {
  ttl?: number;
  version?: string;
  persistent?: boolean;
  priority?: 'memory' | 'storage' | 'both';
}

// Valid entry checker
export function isValidEntry<T>(
  entry: CacheEntry<T>,
  version: string,
  maxAge?: number
): boolean {
  if (entry.version !== version) {
    return false;
  }

  const age = Date.now() - entry.timestamp;
  const ttl = maxAge ?? entry.ttl;

  if (ttl !== Infinity && age > ttl) {
    return false;
  }

  return true;
}
