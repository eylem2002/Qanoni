/* ══════════════════════════════════════════════════════════
   LAW SERVICE

   Cross-domain access to the external Jordanian law (RAG) system.
   - Wraps the low-level HTTP client with a TTL cache (1 hour default).
   - Detects law version changes across cache refreshes and writes a
     law_notifications record so the admin dashboard can surface them.
   - Falls back to static text when the RAG service is unreachable.
══════════════════════════════════════════════════════════ */

import { and, isNull, eq } from "drizzle-orm";
import {
  retrieveArticlesForContract,
  formatArticlesForPrompt,
  type RagArticle,
  type RagRetrievalResult,
} from "./lawClient";
import {
  getCached,
  setCached,
  getLastKnownVersionIds,
} from "./ragCache";
import { db, lawNotificationsTable } from "@workspace/db";

export {
  retrieveArticlesForContract,
  formatArticlesForPrompt,
  extractLawVersionInfo,
} from "./lawClient";
export type { RagArticle, RagRetrievalResult } from "./lawClient";
export { invalidateCache, getCacheStats } from "./ragCache";

interface LawLogger {
  warn: (obj: object, msg: string) => void;
}

/** Write a DB record when the RAG system returns a new law version. */
async function recordVersionChange(
  contractType: string,
  previousVersionIds: string[],
  newVersionIds: string[],
  log: LawLogger,
): Promise<void> {
  const prev = [...previousVersionIds].sort().join(",");
  const next = [...newVersionIds].sort().join(",");
  if (prev === next) return;

  try {
    await db.insert(lawNotificationsTable).values({
      contractType,
      previousVersionIds,
      newVersionIds,
    });
  } catch (err) {
    log.warn(
      { err, contractType, previousVersionIds, newVersionIds },
      "Failed to write law version change notification to DB",
    );
  }
}

/** Fetch from RAG, compare versions, update cache. */
async function fetchAndCache(
  contractType: string,
  log: LawLogger,
): Promise<RagRetrievalResult> {
  const previousVersionIds = getLastKnownVersionIds(contractType);
  const fresh = await retrieveArticlesForContract(contractType);
  await recordVersionChange(contractType, previousVersionIds, fresh.lawVersionIds, log);
  setCached(contractType, fresh);
  return fresh;
}

/** Fetch RAG law text for a contract type, falling back gracefully. */
export async function loadArticles(
  contractType: string,
  log: LawLogger,
  fallbackText = "النصوص القانونية المرجعية غير متاحة حالياً.",
): Promise<{
  articlesText: string;
  lawWarnings: string[];
  articles: RagArticle[];
  lawVersionIds: string[];
  retrievedAt: string | null;
  ragDisclaimer: string | undefined;
}> {
  const lawWarnings: string[] = [];

  const cached = getCached(contractType);
  if (cached) {
    return {
      articlesText: formatArticlesForPrompt(cached.articles),
      lawWarnings,
      articles: cached.articles,
      lawVersionIds: cached.lawVersionIds,
      retrievedAt: cached.retrievedAt,
      ragDisclaimer: cached.disclaimer ?? undefined,
    };
  }

  try {
    const result = await fetchAndCache(contractType, log);
    return {
      articlesText: formatArticlesForPrompt(result.articles),
      lawWarnings,
      articles: result.articles,
      lawVersionIds: result.lawVersionIds,
      retrievedAt: result.retrievedAt,
      ragDisclaimer: result.disclaimer ?? undefined,
    };
  } catch (error) {
    log.warn(
      { error: (error as Error).message, contractType },
      "Failed to retrieve articles from law system, using fallback",
    );
    lawWarnings.push(
      "تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.",
    );
    return {
      articlesText: fallbackText,
      lawWarnings,
      articles: [],
      lawVersionIds: [],
      retrievedAt: null,
      ragDisclaimer: undefined,
    };
  }
}

/** Returns all unacknowledged law change notifications. */
export async function getUnacknowledgedChanges() {
  return db
    .select()
    .from(lawNotificationsTable)
    .where(isNull(lawNotificationsTable.acknowledgedAt))
    .orderBy(lawNotificationsTable.detectedAt);
}

/** Marks all (or one contractType's) unacknowledged notifications as acknowledged. */
export async function acknowledgeChanges(contractType?: string): Promise<void> {
  const now = new Date();
  if (contractType) {
    await db
      .update(lawNotificationsTable)
      .set({ acknowledgedAt: now })
      .where(
        and(
          eq(lawNotificationsTable.contractType, contractType),
          isNull(lawNotificationsTable.acknowledgedAt),
        ),
      );
  } else {
    await db
      .update(lawNotificationsTable)
      .set({ acknowledgedAt: now })
      .where(isNull(lawNotificationsTable.acknowledgedAt));
  }
}
