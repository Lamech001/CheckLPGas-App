import { CACHE_TTL, setCache, getCache, CACHE_KEYS } from '@/services/enhancedCache';

export type PersistentRole = 'consumer' | 'supplier';

const SESSION_MARKER_KEY = CACHE_KEYS.AUTH.SESSION;
const SESSION_VERSION = '1.0';

export type PersistentSession = {
  role: PersistentRole;
  uid: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
};

/**
 * Store a long-lived session marker locally.
 * This is only a *local cache marker*; Firebase auth still controls real access.
 */
export async function persistVerifiedSession(
  session: Omit<PersistentSession, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const now = Date.now();
  const payload: PersistentSession = {
    ...session,
    createdAt: now,
    updatedAt: now,
  };

  await setCache<PersistentSession>(
    SESSION_MARKER_KEY,
    payload,
    {
      ttl: Number.POSITIVE_INFINITY,
      version: SESSION_VERSION,
      persistent: true,
      priority: 'both',
    }
  );
}

/**
 * Read local session marker.
 */
export async function getPersistentSession(): Promise<PersistentSession | null> {
  return getCache<PersistentSession>(SESSION_MARKER_KEY, {
    version: SESSION_VERSION,
    maxAge: Number.POSITIVE_INFINITY,
  });
}

/**
 * Clear local session marker.
 */
export async function clearPersistentSession(): Promise<void> {
  // Setting to null keeps key but invalidates type; safer to overwrite.
  await setCache<any>(
    SESSION_MARKER_KEY,
    null,
    {
      ttl: 1,
      version: SESSION_VERSION,
      persistent: true,
      priority: 'both',
    }
  ).catch(() => {});
}

/**
 * Helper: check if a cached session exists and is email-verified.
 */
export async function isPersistentSessionVerified(): Promise<boolean> {
  const session = await getPersistentSession();
  return !!session?.emailVerified;
}

export { CACHE_KEYS };

