import type { RagRetrievalResult } from "./lawClient";

const TTL_MS = Number(process.env.RAG_CACHE_TTL_MS ?? 60 * 60 * 1000); // 1 hour default

interface CacheEntry {
  result: RagRetrievalResult;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

// Populated at startup from law_notifications DB rows so stale-contract checks
// work correctly even before the first RAG fetch after a server restart.
const seededVersionIds = new Map<string, string[]>();

export function getCached(contractType: string): RagRetrievalResult | null {
  const entry = store.get(contractType);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.result;
}

/** Returns the last known version IDs even if the cache entry has expired.
    Falls back to DB-seeded values so cold-start stale checks are reliable. */
export function getLastKnownVersionIds(contractType: string): string[] {
  return (
    store.get(contractType)?.result.lawVersionIds ??
    seededVersionIds.get(contractType) ??
    []
  );
}

/** Seeds version IDs from the DB at startup without warming the TTL cache.
    Skipped if the live cache already has an entry for this contractType. */
export function seedVersionIds(contractType: string, versionIds: string[]): void {
  if (!seededVersionIds.has(contractType)) {
    seededVersionIds.set(contractType, versionIds);
  }
}

export function setCached(contractType: string, result: RagRetrievalResult): void {
  store.set(contractType, { result, expiresAt: Date.now() + TTL_MS });
}

/** Invalidates one contractType (or all entries if no argument given). */
export function invalidateCache(contractType?: string): void {
  if (contractType) {
    store.delete(contractType);
  } else {
    store.clear();
  }
}

export function getCacheStats(): Record<string, { expiresAt: number; fresh: boolean }> {
  const now = Date.now();
  const stats: Record<string, { expiresAt: number; fresh: boolean }> = {};
  for (const [key, entry] of store.entries()) {
    stats[key] = { expiresAt: entry.expiresAt, fresh: now < entry.expiresAt };
  }
  return stats;
}
