import type { RequestHandler } from "express";
import { getUnacknowledgedChanges, acknowledgeChanges } from "../../services/law/LawService";
import { invalidateCache, getCacheStats } from "../../services/law/ragCache";

/** GET /api/admin/law-changes — lists all unacknowledged law version changes. */
export const listLawChanges: RequestHandler = async (_req, res, next) => {
  try {
    const changes = await getUnacknowledgedChanges();
    res.json({ changes, cacheStats: getCacheStats() });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/law-changes/acknowledged
 *
 * Body (optional): { contractType: string }
 *   - With contractType: acknowledges only that type and invalidates its cache entry.
 *   - Without contractType: acknowledges all pending changes and clears the entire cache,
 *     so every subsequent contract generation fetches fresh law text from the RAG service.
 */
export const acknowledgeAndRefresh: RequestHandler = async (req, res, next) => {
  try {
    const { contractType } = req.body as { contractType?: string };
    await acknowledgeChanges(contractType);
    invalidateCache(contractType);
    res.json({ acknowledged: true, cacheStats: getCacheStats() });
  } catch (err) {
    next(err);
  }
};
