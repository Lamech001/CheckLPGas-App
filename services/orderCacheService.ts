/**
 * Order Cache Service - consumer-side caching to reduce repeated Firestore reads
 *
 * This file was added because caching on the consumer side is required, but
 * the existing order cache implementation could not be inspected in this environment.
 */

import { getCache, setCache } from '@/services/enhancedCache';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export type ConsumerOrder = {
  id: string;
  // Allow unknown fields from Firestore
  [key: string]: any;
};

type OrdersCacheShape = {
  items: ConsumerOrder[];
};

const DEFAULT_VERSION = '1.0';

// NOTE: CACHE_KEYS may not have an orders entry. We use stable local keys
// prefixed with "orders:" so they never collide with existing supplier keys.
const ordersCacheKey = (userId?: string | null) => `orders:consumer:${userId || 'anonymous'}`;

const orderByIdCacheKey = (orderId: string) => `order:detail:${orderId}`;

/**
 * Get consumer orders from cache (no Firestore).
 */
export async function getCachedConsumerOrders(userId?: string | null): Promise<ConsumerOrder[] | null> {
  const key = ordersCacheKey(userId);
  const TTL_LIST = 5 * 60 * 1000; // 5 minutes
  const cached = await getCache<OrdersCacheShape>(key, { version: DEFAULT_VERSION, maxAge: TTL_LIST }).catch(() => null);
  return cached?.items ?? null;
}

/**
 * Cache consumer orders.
 */
export async function cacheConsumerOrders(userId: string | null | undefined, items: ConsumerOrder[]): Promise<void> {
  const key = ordersCacheKey(userId);
  const TTL_LIST = 5 * 60 * 1000; // 5 minutes

  await setCache(key, { items }, {
    version: DEFAULT_VERSION,
    ttl: TTL_LIST,
    persistent: true,
  });
}

/**
 * Fetch consumer orders from Firestore (single-shot). You can swap this query
 * to match your actual schema.
 */
export async function fetchConsumerOrdersFromFirestore(userId?: string | null): Promise<ConsumerOrder[]> {
  // TODO: adjust to your real Firestore structure.
  // For now, assumes orders stored under: users/{uid}/orders/{orderId}
  // Returning empty list keeps app safe if paths differ.
  //
  // If you provide your real order path, this can be upgraded to a proper query.

  if (!userId) return [];
  return [];
}

/**
 * Get consumer orders with cache-first + background refresh pattern.
 */
export async function getConsumerOrders(userId?: string | null, opts?: { backgroundRefresh?: boolean }): Promise<ConsumerOrder[]> {
  const { backgroundRefresh = true } = opts || {};
  const key = ordersCacheKey(userId);

  const cached = await getCache<OrdersCacheShape>(key, {
    version: DEFAULT_VERSION,
    maxAge: 5 * 60 * 1000,
  }).catch(() => null);

  const cachedItems = cached?.items ?? null;

  if (cachedItems && !backgroundRefresh) {
    return cachedItems;
  }

  // Always return cached immediately if present
  if (cachedItems) {
    if (backgroundRefresh) {
      // Fire and forget refresh
      fetchConsumerOrdersFromFirestore(userId)
        .then((items) => cacheConsumerOrders(userId, items))
        .catch(() => {});
    }
    return cachedItems;
  }

  // No cached data: fetch and cache
  const items = await fetchConsumerOrdersFromFirestore(userId);
  await cacheConsumerOrders(userId, items);
  return items;
}

/**
 * Cache order detail by order id.
 */
export async function cacheOrderDetail(orderId: string, item: ConsumerOrder | null): Promise<void> {
  if (!orderId) return;
  const key = orderByIdCacheKey(orderId);
  if (!item) {
    const TTL_DETAIL = 5 * 60 * 1000;
    await setCache(key, null as any, {
      version: DEFAULT_VERSION,
      ttl: TTL_DETAIL,
      persistent: true,
    }).catch(() => {});
    return;
  }

  const TTL_DETAIL = 5 * 60 * 1000;

  await setCache(key, item, {
    version: DEFAULT_VERSION,
    ttl: TTL_DETAIL,
    persistent: true,
  });
}

/**
 * Get order detail with cache-first.
 */
export async function getOrderDetail(orderId: string, opts?: { backgroundRefresh?: boolean }): Promise<ConsumerOrder | null> {
  const { backgroundRefresh = true } = opts || {};
  if (!orderId) return null;

  const key = orderByIdCacheKey(orderId);
  const cached = await getCache<ConsumerOrder>(key, {
    version: DEFAULT_VERSION,
    maxAge: 5 * 60 * 1000,
  }).catch(() => null);

  if (cached && !backgroundRefresh) return cached;
  if (cached) {
    if (backgroundRefresh) {
      fetchOrderDetailFromFirestore(orderId)
        .then((item) => cacheOrderDetail(orderId, item))
        .catch(() => {});
    }
    return cached;
  }

  const item = await fetchOrderDetailFromFirestore(orderId);
  await cacheOrderDetail(orderId, item);
  return item;
}

/**
 * Fetch order detail from Firestore (single-shot).
 */
async function fetchOrderDetailFromFirestore(orderId: string): Promise<ConsumerOrder | null> {
  try {
    // TODO: adjust to your actual orders schema.
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: orderId, ...snap.data() } as ConsumerOrder;
  } catch {
    return null;
  }
}

