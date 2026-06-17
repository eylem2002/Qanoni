/* ══════════════════════════════════════════════════════════
   CONTRACTS LOGIC

   Pure orchestration: turns a validated request body into a fully
   resolved generation plan (template + sanitized data + RAG law text +
   deterministic verifier). Knows nothing about req/res — the controller
   wires the returned plan into the NDJSON streaming engine.
══════════════════════════════════════════════════════════ */

import type { ContractTemplate, ValidationResult } from "../clauses";
import { contractRegistry } from "./contractRegistry";
import { sanitizeObject } from "../../../core/utils/sanitizer";
import { loadArticles } from "../../../services/law/LawService";
import { NotFoundError } from "../../../core/errors";

export interface GenerationPlan {
  template: ContractTemplate<Record<string, unknown>>;
  data: Record<string, unknown>;
  articlesText: string;
  validate: (assembled: string) => ValidationResult;
  lawWarnings: string[];
  errorLabel: string;
  incompleteError: string;
  failureError: string;
}

interface PrepareLogger {
  warn: (obj: object, msg: string) => void;
}

/** Deterministic verification run on the assembled whole document. */
function verifyRequiredPhrases(
  text: string,
  requiredPhrases: readonly string[],
  minLength: number,
): { valid: boolean; missing: string[] } {
  if (text.length < minLength) {
    return {
      valid: false,
      missing: ["العقد قصير بشكل غير عادي — التوليد لم يكتمل"],
    };
  }
  const missing = requiredPhrases.filter((p) => !text.includes(p));
  return { valid: missing.length === 0, missing };
}

export async function prepareGeneration(
  type: string,
  body: Record<string, unknown>,
  log: PrepareLogger,
): Promise<GenerationPlan> {
  const config = contractRegistry[type];
  if (!config) {
    throw new NotFoundError(`نوع العقد غير معروف: ${type}`);
  }

  const data = sanitizeObject(body);
  config.guard?.(data);

  const { articlesText, lawWarnings } = await loadArticles(
    config.type,
    log,
    config.fallbackLaw,
  );

  const validate = (assembled: string): ValidationResult => {
    const { valid, missing } = verifyRequiredPhrases(
      assembled,
      config.required,
      config.minLength,
    );
    const warnings = config.extraWarnings ? config.extraWarnings(data) : [];
    return { valid, missingClauses: missing, warnings };
  };

  return {
    template: config.template,
    data,
    articlesText,
    validate,
    lawWarnings,
    errorLabel: config.errorLabel,
    incompleteError: config.incompleteError,
    failureError: config.failureError,
  };
}
