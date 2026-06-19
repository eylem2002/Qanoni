import type { RagRetrievalResult } from "./lawClient";

const TTL_MS = Number(process.env.RAG_CACHE_TTL_MS ?? 60 * 60 * 1000); // 1 hour default

interface CacheEntry {
  result: RagRetrievalResult;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function getCached(contractType: string): RagRetrievalResult | null {
  const entry = store.get(contractType);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.result;
}

/** Returns the last known version IDs even if the cache entry has expired.
    Used by LawService to detect law version changes across refreshes. */
export function getLastKnownVersionIds(contractType: string): string[] {
  return store.get(contractType)?.result.lawVersionIds ?? [];
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
