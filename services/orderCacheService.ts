/**
 * Order Cache Service - consumer-side caching to reduce repeated Firestore reads
 *
 * Offline-first persistence:
 * - Stores consumer order list + order detail in AsyncStorage
 * - Returns cached data immediately when available
 * - Background refresh overwrites local data with server data on success
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';

type CacheLogContext = {
  key: string;
  backgroundRefresh?: boolean;
  orderId?: string;
};

function safeLogError(message: string, err: unknown, context?: CacheLogContext) {
  try {
    const error = err instanceof Error ? err : undefined;
    // eslint-disable-next-line no-console
    console.error(message, {
      ...(error ? { name: error.name, message: error.message, stack: error.stack } : { err }),
      ...(context || {}),
    });
  } catch {
    // no-op: logging must never break UI
  }
}

export type ConsumerOrder = {
  id: string;
  // Allow unknown fields from Firestore
  [key: string]: any;
};

type OrdersCacheShape = {
  items: ConsumerOrder[];
};

type PersistentCache<T> = {
  v: string;
  updatedAt: number;
  data: T;
};

const OFFLINE_LIST_VERSION = '1.0';
const OFFLINE_DETAIL_VERSION = '1.0';

// Stable keys; prevent collisions with other app caches.
const ordersCacheKey = (userId?: string | null) => `offline:orders:consumer:${userId || 'anonymous'}`;
const orderByIdCacheKey = (orderId: string) => `offline:order:detail:${orderId}`;

function parsePersistentCache<T>(raw: string | null, expectedV: string): PersistentCache<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistentCache<T>;
    if (!parsed || parsed.v !== expectedV) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readPersistent<T>(key: string, expectedV: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = parsePersistentCache<T>(raw, expectedV);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

async function writePersistent<T>(key: string, expectedV: string, data: T): Promise<void> {
  const payload: PersistentCache<T> = {
    v: expectedV,
    updatedAt: Date.now(),
    data,
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Silent fail - offline cache must never break UI
  }
}

/**
 * Get consumer orders from local AsyncStorage only.
 */
export async function getCachedConsumerOrders(userId?: string | null): Promise<ConsumerOrder[] | null> {
  const key = ordersCacheKey(userId);
  const cached = await readPersistent<OrdersCacheShape>(key, OFFLINE_LIST_VERSION);
  return cached?.items ?? null;
}

/**
 * Persist consumer orders list locally.
 */
export async function cacheConsumerOrders(
  userId: string | null | undefined,
  items: ConsumerOrder[],
): Promise<void> {
  const key = ordersCacheKey(userId);
  await writePersistent<OrdersCacheShape>(key, OFFLINE_LIST_VERSION, { items });
}

/**
 * Fetch consumer orders from Firestore (single-shot).
 */
export async function fetchConsumerOrdersFromFirestore(
  userId?: string | null,
): Promise<ConsumerOrder[]> {
  try {
    if (!userId) return [];

    const { collection, getDocs, query } = await import('firebase/firestore');

    const ordersCol = collection(db, 'users', userId, 'orders');
    const q = query(ordersCol);

    const snap = await getDocs(q);
    const items: ConsumerOrder[] = [];

    snap.forEach((docSnap: { id: string; data: () => unknown }) => {
      items.push({
        id: docSnap.id,
        ...(docSnap.data() as any),
      });
    });

    return items;
  } catch (err) {
    safeLogError('Failed to fetch consumer orders from Firestore', err, { key: ordersCacheKey(userId) });
    return [];
  }
}

function extractUpdatedAtMillis(order: ConsumerOrder): number | null {
  const v = order?.updatedAt ?? order?.lastUpdatedAt ?? order?.updated_at;
  if (!v) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  // Firestore Timestamp shape: { seconds, nanoseconds }
  if (typeof v === 'object' && v) {
    const seconds = (v as any).seconds;
    const nanos = (v as any).nanoseconds;
    if (typeof seconds === 'number') {
      return seconds * 1000 + (typeof nanos === 'number' ? nanos / 1_000_000 : 0);
    }
  }
  return null;
}

function shouldPreferServerOverLocal(server: ConsumerOrder | null, local: ConsumerOrder | null): boolean {
  // Server wins if local missing.
  if (!local) return true;
  // Server wins if server missing -> keep local.
  if (!server) return false;

  const serverUpdated = extractUpdatedAtMillis(server);
  const localUpdated = extractUpdatedAtMillis(local);

  // If both have updatedAt: newest wins.
  if (serverUpdated != null && localUpdated != null) {
    return serverUpdated >= localUpdated;
  }

  // Fallback: if server and local differ or local has no metadata, prefer server.
  return true;
}

function ordersHaveDifferentShapes(a: ConsumerOrder[] | null, b: ConsumerOrder[] | null): boolean {
  if (!a || !b) return true;
  if (a.length !== b.length) return true;
  // very lightweight: order ids multiset
  const idsA = a.map((x) => x.id).sort();
  const idsB = b.map((x) => x.id).sort();
  for (let i = 0; i < idsA.length; i++) {
    if (idsA[i] !== idsB[i]) return true;
  }
  return false;
}

/**
 * Get consumer orders with offline-first + background server overwrite.
 */
export async function getConsumerOrders(
  userId?: string | null,
  opts?: { backgroundRefresh?: boolean },
): Promise<ConsumerOrder[]> {
  const backgroundRefresh = opts?.backgroundRefresh ?? true;

  const key = ordersCacheKey(userId);

  const cached = await readPersistent<OrdersCacheShape>(key, OFFLINE_LIST_VERSION);
  const cachedItems = cached?.items ?? null;

  if (cachedItems && !backgroundRefresh) return cachedItems;

  if (cachedItems) {
    if (backgroundRefresh) {
      // Background refresh: server is the source of truth.
      fetchConsumerOrdersFromFirestore(userId)
        .then(async (serverItems) => {
          try {
            // If we have local data, we only overwrite if server seems newer/different.
            if (!cachedItems || ordersHaveDifferentShapes(cachedItems, serverItems)) {
              await cacheConsumerOrders(userId, serverItems);
              return;
            }

            // Same ids -> try updatedAt merge decision per order.
            const localById = new Map(cachedItems.map((o) => [o.id, o] as const));
            const merged = serverItems.map((s) => {
              const local = localById.get(s.id) ?? null;
              if (shouldPreferServerOverLocal(s, local)) return s;
              return local ?? s;
            });

            // Overwrite only if merged changed.
            const mergedIds = merged.map((x) => x.id).join('|');
            const cachedIds = cachedItems.map((x) => x.id).join('|');
            if (mergedIds !== cachedIds) {
              await cacheConsumerOrders(userId, merged);
            } else {
              // If ids same, we still may want to update fields; prefer overwrite when server has newer.
              // We'll do overwrite when any order differs by updatedAt.
              const anyNewer = serverItems.some((s) => {
                const local = localById.get(s.id) ?? null;
                if (!local) return true;
                return shouldPreferServerOverLocal(s, local);
              });
              if (anyNewer) await cacheConsumerOrders(userId, merged);
            }
          } catch {
            // ignore
          }
        })
        .catch(() => {});
    }

    return cachedItems;
  }

  // No local cache: fetch fresh.
  const serverItems = await fetchConsumerOrdersFromFirestore(userId);
  await cacheConsumerOrders(userId, serverItems);
  return serverItems;
}

/**
 * Persist order detail locally.
 */
export async function cacheOrderDetail(orderId: string, item: ConsumerOrder | null): Promise<void> {
  if (!orderId) return;
  const key = orderByIdCacheKey(orderId);
  if (!item) {
    await writePersistent<ConsumerOrder | null>(key, OFFLINE_DETAIL_VERSION, null);
    return;
  }

  await writePersistent<ConsumerOrder>(key, OFFLINE_DETAIL_VERSION, item);
}

async function readOrderDetailLocal(orderId: string): Promise<ConsumerOrder | null> {
  const key = orderByIdCacheKey(orderId);
  return readPersistent<ConsumerOrder | null>(key, OFFLINE_DETAIL_VERSION);
}

/**
 * Fetch order detail from Firestore (single-shot).
 */
async function fetchOrderDetailFromFirestore(orderId: string): Promise<ConsumerOrder | null> {
  try {
    const { doc, getDoc } = await import('firebase/firestore');

    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    return { id: orderId, ...(snap.data() as any) } as ConsumerOrder;
  } catch (err) {
    safeLogError('Failed to fetch order detail from Firestore', err, {
      key: orderByIdCacheKey(orderId),
      orderId,
    });
    return null;
  }
}

/**
 * Get order detail with offline-first + background refresh.
 * Conflict resolution: keep local when server is null/older; otherwise overwrite local.
 */
export async function getOrderDetail(
  orderId: string,
  opts?: { backgroundRefresh?: boolean },
): Promise<ConsumerOrder | null> {
  const backgroundRefresh = opts?.backgroundRefresh ?? true;
  if (!orderId) return null;

  const key = orderByIdCacheKey(orderId);

  const cached = await readPersistent<ConsumerOrder | null>(key, OFFLINE_DETAIL_VERSION);
  if (cached && !backgroundRefresh) return cached;

  if (cached) {
    if (backgroundRefresh) {
      fetchOrderDetailFromFirestore(orderId)
        .then(async (serverItem) => {
          try {
            if (!shouldPreferServerOverLocal(serverItem, cached)) return;
            await cacheOrderDetail(orderId, serverItem);
          } catch {
            // ignore
          }
        })
        .catch(() => {});
    }

    return cached;
  }

  const serverItem = await fetchOrderDetailFromFirestore(orderId);
  await cacheOrderDetail(orderId, serverItem);
  return serverItem;
}

