/* ══════════════════════════════════════════════════════════
   LAW SERVICE

   Cross-domain access to the external Jordanian law (RAG) system.
   Wraps the low-level client and adds the graceful-fallback loader
   used by contract generation.
══════════════════════════════════════════════════════════ */

import {
  retrieveArticlesForContract,
  formatArticlesForPrompt,
  type RagArticle,
} from "./lawClient";

export {
  retrieveArticlesForContract,
  formatArticlesForPrompt,
  extractLawVersionInfo,
} from "./lawClient";
export type { RagArticle, RagRetrievalResult } from "./lawClient";

interface LawLogger {
  warn: (obj: object, msg: string) => void;
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
}> {
  const lawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract(contractType);
    return {
      articlesText: formatArticlesForPrompt(ragResult.articles),
      lawWarnings,
      articles: ragResult.articles,
      lawVersionIds: ragResult.lawVersionIds,
      retrievedAt: ragResult.retrievedAt,
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
    };
  }
}
