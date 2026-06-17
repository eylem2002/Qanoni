/* ══════════════════════════════════════════════════════════
   LAW SERVICE

   Cross-domain access to the external Jordanian law (RAG) system.
   Wraps the low-level client and adds the graceful-fallback loader
   used by contract generation.
══════════════════════════════════════════════════════════ */

import {
  retrieveArticlesForContract,
  formatArticlesForPrompt,
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
): Promise<{ articlesText: string; lawWarnings: string[] }> {
  const lawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract(contractType);
    return {
      articlesText: formatArticlesForPrompt(ragResult.articles),
      lawWarnings,
    };
  } catch (error) {
    log.warn(
      { error: (error as Error).message, contractType },
      "Failed to retrieve articles from law system, using fallback",
    );
    lawWarnings.push(
      "تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.",
    );
    return { articlesText: fallbackText, lawWarnings };
  }
}
