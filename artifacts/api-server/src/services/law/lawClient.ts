// Client for retrieving articles from the law system
// This code talks to the separate Law System Replit project

export interface RagArticle {
  lawId: string;
  lawNameAr: string;
  articleNumber: number;
  text: string;
  priority: 1 | 2;
  lastUpdated: string;
}

export interface RagRetrievalResult {
  contractType: string;
  lawVersionIds: string[];
  articleCount: number;
  articles: RagArticle[];
  retrievedAt: string;
  disclaimer: string;
}

/**
 * Main function: Query the law system for articles
 * Call this from contract generation routes
 */
const LAW_SYSTEM_TIMEOUT_MS = 8000;

export async function retrieveArticlesForContract(
  contractType: string,
  lawSystemBaseUrl: string = process.env.RAG_BASE_URL || "http://localhost:8080"
): Promise<RagRetrievalResult> {
  const url = new URL(`${lawSystemBaseUrl}/api/rag/retrieve`);
  url.searchParams.set("contractType", contractType);

  // Bound the call: a slow/hanging law system must surface as an error so the
  // caller (LawService.loadArticles) can degrade to its fallback rather than
  // stalling the whole generation request.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LAW_SYSTEM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to retrieve articles: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<RagRetrievalResult>;
}

/**
 * Helper: Format articles into a text block for embedding in prompts
 */
export function formatArticlesForPrompt(articles: RagArticle[]): string {
  const lawIds = Array.from(new Set(articles.map((a) => a.lawId)));

  let result = "النصوص القانونية الحالية:\n\n";

  for (const lawId of lawIds) {
    const lawArticles = articles.filter((a) => a.lawId === lawId);
    const lawName = lawArticles[0]?.lawNameAr ?? lawId;

    result += `${lawName} (رقم ${lawId}):\n`;
    for (const article of lawArticles) {
      result += `\nالمادة ${article.articleNumber}:\n${article.text}\n`;
    }
    result += "\n" + "─".repeat(50) + "\n\n";
  }

  return result;
}

/**
 * Helper: Extract version info for storing with contracts
 */
export function extractLawVersionInfo(result: RagRetrievalResult): {
  lawVersionIds: string[];
  retrievedAt: string;
} {
  return {
    lawVersionIds: result.lawVersionIds,
    retrievedAt: result.retrievedAt,
  };
}
