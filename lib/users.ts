/**
 * Lightweight client-side user lookup with in-memory cache.
 *
 * The dashboard / forum / post pages render `authorId` (a Firebase uid) in
 * places where a human-readable name is expected. This module provides a
 * batched, cached lookup so those views can show display names without
 * hammering Firestore.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

interface CachedUser {
  name: string;
  userType?: string;
}

const cache = new Map<string, CachedUser>();
const inflight = new Map<string, Promise<CachedUser>>();

export async function fetchUserSummary(uid: string): Promise<CachedUser> {
  if (!uid) return { name: 'Unknown' };
  const cached = cache.get(uid);
  if (cached) return cached;

  const existing = inflight.get(uid);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const data = snap.exists() ? (snap.data() as { name?: string; userType?: string }) : null;
      const result: CachedUser = {
        name: data?.name?.trim() || 'Adal Nexus member',
        userType: data?.userType,
      };
      cache.set(uid, result);
      return result;
    } catch (error) {
      console.error('Error fetching user summary:', error);
      const fallback: CachedUser = { name: 'Adal Nexus member' };
      cache.set(uid, fallback);
      return fallback;
    } finally {
      inflight.delete(uid);
    }
  })();

  inflight.set(uid, promise);
  return promise;
}

export async function fetchUserNames(uids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const entries = await Promise.all(
    unique.map(async (uid) => [uid, (await fetchUserSummary(uid)).name] as const)
  );
  return Object.fromEntries(entries);
}
