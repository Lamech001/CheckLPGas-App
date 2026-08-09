/**
 * Dashboard State Service - Persists dashboard state for seamless UX
 * Saves and restores dashboard state for both consumer and supplier views
 */

import { CACHE_TTL, getCache, removeCache, setCache } from '@/services/enhancedCache';

// Dedicated cache keys for dashboard state to avoid conflicts
const CONSUMER_DASHBOARD_KEY = 'dashboard:consumer:state';
const SUPPLIER_DASHBOARD_KEY = 'dashboard:supplier:state';

export interface ConsumerDashboardState {
  selectedSize: 'all' | 6 | 13 | 19;
  viewMode: 'list' | 'map';
  selectedSupplierId: string | null;
  scrollPosition: number;
  lastRefreshTime: number;
  filters: {
    minRating: number;
    maxPrice: number;
    isOpenOnly: boolean;
  };
}

export interface SupplierDashboardState {
  selectedTab: 'overview' | 'orders' | 'chat' | 'settings';
  shopStatus: boolean;
  lastPriceUpdate: number;
  scrollPosition: number;
  editingPrice: boolean;
}

const DEFAULT_CONSUMER_STATE: ConsumerDashboardState = {
  selectedSize: 'all',
  viewMode: 'list',
  selectedSupplierId: null,
  scrollPosition: 0,
  lastRefreshTime: 0,
  filters: {
    minRating: 0,
    maxPrice: Number.MAX_VALUE,
    isOpenOnly: false,
  },
};

const DEFAULT_SUPPLIER_STATE: SupplierDashboardState = {
  selectedTab: 'overview',
  shopStatus: true,
  lastPriceUpdate: 0,
  scrollPosition: 0,
  editingPrice: false,
};

/**
 * Save consumer dashboard state
 */
export async function saveConsumerDashboardState(
  state: Partial<ConsumerDashboardState>
): Promise<void> {
  try {
    const currentState = await getConsumerDashboardState();
    const mergedState = { ...currentState, ...state };
    
    await setCache(
      CONSUMER_DASHBOARD_KEY,
      { ...mergedState, lastSaved: Date.now() },
      {
        ttl: CACHE_TTL.USER.SETTINGS, // 24 hours
        version: '1.0',
        persistent: true,
        priority: 'both',
      }
    );
  } catch (error) {
    console.warn('[DashboardState] Failed to save consumer state:', error);
  }
}

/**
 * Get consumer dashboard state
 */
export async function getConsumerDashboardState(): Promise<ConsumerDashboardState> {
  try {
    const cached = await getCache<ConsumerDashboardState & { lastSaved?: number }>(
      CONSUMER_DASHBOARD_KEY,
      { version: '1.0' }
    );
    
    if (cached) {
      // Return cached state, merging with defaults to ensure all fields exist
      return { ...DEFAULT_CONSUMER_STATE, ...cached };
    }
    
    return DEFAULT_CONSUMER_STATE;
  } catch {
    return DEFAULT_CONSUMER_STATE;
  }
}

/**
 * Save supplier dashboard state
 */
export async function saveSupplierDashboardState(
  state: Partial<SupplierDashboardState>
): Promise<void> {
  try {
    const currentState = await getSupplierDashboardState();
    const mergedState = { ...currentState, ...state };
    
    await setCache(
      SUPPLIER_DASHBOARD_KEY,
      { ...mergedState, lastSaved: Date.now() },
      {
        ttl: CACHE_TTL.USER.SETTINGS, // 24 hours
        version: '1.0',
        persistent: true,
        priority: 'both',
      }
    );
  } catch (error) {
    console.warn('[DashboardState] Failed to save supplier state:', error);
  }
}

/**
 * Get supplier dashboard state
 */
export async function getSupplierDashboardState(): Promise<SupplierDashboardState> {
  try {
    const cached = await getCache<SupplierDashboardState & { lastSaved?: number }>(
      SUPPLIER_DASHBOARD_KEY,
      { version: '1.0' }
    );
    
    if (cached) {
      return { ...DEFAULT_SUPPLIER_STATE, ...cached };
    }
    
    return DEFAULT_SUPPLIER_STATE;
  } catch {
    return DEFAULT_SUPPLIER_STATE;
  }
}

/**
 * Clear consumer dashboard state
 */
export async function clearConsumerDashboardState(): Promise<void> {
  try {
    await removeCache(CONSUMER_DASHBOARD_KEY);
  } catch (error) {
    console.warn('[DashboardState] Failed to clear consumer state:', error);
  }
}

/**
 * Clear supplier dashboard state
 */
export async function clearSupplierDashboardState(): Promise<void> {
  try {
    await removeCache(SUPPLIER_DASHBOARD_KEY);
  } catch (error) {
    console.warn('[DashboardState] Failed to clear supplier state:', error);
  }
}

/**
 * Clear all dashboard states
 */
export async function clearAllDashboardStates(): Promise<void> {
  await Promise.all([
    clearConsumerDashboardState(),
    clearSupplierDashboardState(),
  ]);
}

/**
 * Check if dashboard state is stale (older than specified time)
 */
export async function isDashboardStateStale(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
  try {
    const consumerState = await getCache<{ lastSaved?: number }>(
      CONSUMER_DASHBOARD_KEY,
      { version: '1.0' }
    );
    
    if (consumerState?.lastSaved) {
      const age = Date.now() - consumerState.lastSaved;
      return age > maxAgeMs;
    }
    
    return true; // No cached state = stale
  } catch {
    return true;
  }
}
