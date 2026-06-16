import { getPersistentSession } from '@/services/persistenceSessionService';

/**
 * Enforces verified-only access at runtime using the local persistence marker.
 * Note: Firebase is still source-of-truth, but this guard prevents offline bypass.
 */
export type GuardRole = 'consumer' | 'supplier';

export async function canAccessVerifiedRole(role: GuardRole): Promise<boolean> {
  const session = await getPersistentSession();
  return !!session?.emailVerified && session?.role === role && !!session?.uid;
}

export async function ensureVerifiedRole(role: GuardRole): Promise<boolean> {
  return canAccessVerifiedRole(role);
}

