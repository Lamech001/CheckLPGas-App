import AsyncStorage from '@react-native-async-storage/async-storage';

export type OrderStatus = string;

export interface LocalOrderHistoryItem {
  orderId: string;
  cylinderSize: string;
  quantity: number;
  deliveryAddress: string;
  /** ISO string */
  date: string;
  status: OrderStatus;
}

export interface AddLocalOrderHistoryItem extends Omit<LocalOrderHistoryItem, 'date'> {
  date?: string;
}

export class OrderHistoryStorageError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'OrderHistoryStorageError';
    this.cause = cause;
  }
}

const HISTORY_KEY_PREFIX = 'order_history:';
const HISTORY_VERSION = '1';

type CacheEntry = {
  version: string;
  items: LocalOrderHistoryItem[];
};

const getHistoryKey = (userId?: string | null) => {
  // If userId is not provided, still persist (single device-wide history).
  // For consumer dashboard this should typically be current user's uid.
  return `${HISTORY_KEY_PREFIX}${userId || 'anonymous'}`;
};

const safeJsonParse = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

/**
 * Add a new order to local history for a given user.
 * - Order is appended.
 * - If an item with same orderId exists, it is replaced.
 */
export async function addOrderToHistory(
  params: {
    userId?: string | null;
    order: AddLocalOrderHistoryItem;
  }
): Promise<{ success: true; items: LocalOrderHistoryItem[] } | { success: false; error: string }> {
  const { userId, order } = params;
  const key = getHistoryKey(userId);

  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = safeJsonParse<CacheEntry>(raw);

    const existing: LocalOrderHistoryItem[] =
      parsed?.version === HISTORY_VERSION && Array.isArray(parsed.items) ? parsed.items : [];

    const nextItem: LocalOrderHistoryItem = {
      orderId: order.orderId,
      cylinderSize: order.cylinderSize,
      quantity: Number(order.quantity),
      deliveryAddress: order.deliveryAddress,
      date: order.date || new Date().toISOString(),
      status: order.status,
    };

    const withoutDup = existing.filter((i) => i.orderId !== nextItem.orderId);
    const items = [...withoutDup, nextItem];

    const entry: CacheEntry = { version: HISTORY_VERSION, items };
    await AsyncStorage.setItem(key, JSON.stringify(entry));

    return { success: true, items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/** Retrieve all saved orders for a given user. */
export async function getAllOrdersFromHistory(
  userId?: string | null
): Promise<{ success: true; items: LocalOrderHistoryItem[] } | { success: false; error: string }> {
  const key = getHistoryKey(userId);

  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = safeJsonParse<CacheEntry>(raw);

    const items =
      parsed?.version === HISTORY_VERSION && Array.isArray(parsed.items) ? parsed.items : [];

    // Sort newest first by date (ISO string)
    const sorted = [...items].sort((a, b) => {
      const ad = Date.parse(a.date);
      const bd = Date.parse(b.date);
      return (Number.isFinite(bd) ? bd : 0) - (Number.isFinite(ad) ? ad : 0);
    });

    return { success: true, items: sorted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/** Delete a specific order by orderId. */
export async function deleteOrderFromHistory(
  params: {
    userId?: string | null;
    orderId: string;
  }
): Promise<{ success: true; items: LocalOrderHistoryItem[] } | { success: false; error: string }> {
  const { userId, orderId } = params;
  const key = getHistoryKey(userId);

  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = safeJsonParse<CacheEntry>(raw);

    const existing: LocalOrderHistoryItem[] =
      parsed?.version === HISTORY_VERSION && Array.isArray(parsed.items) ? parsed.items : [];

    const items = existing.filter((i) => i.orderId !== orderId);
    const entry: CacheEntry = { version: HISTORY_VERSION, items };

    await AsyncStorage.setItem(key, JSON.stringify(entry));
    return { success: true, items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/** Update the status of an existing order in local history. */
export async function updateOrderStatusInHistory(
  params: {
    userId?: string | null;
    orderId: string;
    status: OrderStatus;
    /** ISO string override */
    date?: string;
  }
): Promise<{ success: true; items: LocalOrderHistoryItem[] } | { success: false; error: string }> {
  const { userId, orderId, status, date } = params;
  const key = getHistoryKey(userId);

  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = safeJsonParse<CacheEntry>(raw);

    const existing: LocalOrderHistoryItem[] =
      parsed?.version === HISTORY_VERSION && Array.isArray(parsed.items) ? parsed.items : [];

    const nextItems = existing.map((i) => {
      if (i.orderId !== orderId) return i;
      return {
        ...i,
        status,
        ...(date ? { date } : {}),
      };
    });

    // If not found, keep list unchanged but still return success=false so caller can decide.
    const found = existing.some((i) => i.orderId === orderId);
    if (!found) {
      return { success: false, error: `Order ${orderId} not found in local history.` };
    }

    const entry: CacheEntry = { version: HISTORY_VERSION, items: nextItems };
    await AsyncStorage.setItem(key, JSON.stringify(entry));

    return { success: true, items: nextItems };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/** Clear all order history for a given user. */
export async function clearOrderHistory(
  userId?: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  const key = getHistoryKey(userId);
  try {
    await AsyncStorage.removeItem(key);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}



