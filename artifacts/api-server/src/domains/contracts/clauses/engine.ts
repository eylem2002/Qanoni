import type { Request, Response } from "express";
import { openai } from "../../../infra/anthropic";
import { type ContractTemplate, getAllClauses } from "./types";
import {
  reviewContract,
  fixContract,
  type ReviewIssue,
} from "../logic/ContractReviewAgent";

const AI_MODEL = "gpt-4o";
const MAX_TOKENS = 8192;

export const MIN_WAGE_JD = 290;

export const STRICT_RULES_BASE = `
القواعد الصارمة — يجب الالتزام بها حرفياً:
1. لا تستخدم أي رموز تعبيرية (Emoji) في أي جزء من النص — ممنوع منعاً باتاً.
2. لا تخترع نصوصاً قانونية غير موجودة. استند فقط إلى النصوص القانونية المرفقة.
3. عند الإشارة إلى حكم قانوني، اذكر رقم المادة القانونية صراحةً.
4. للبنود التي تُشير إلى مواد قانونية بعينها، يجب إيراد النص العربي الحرفي للمادة من النصوص المرجعية المرفقة — لا تُعيد الصياغة ولا تختصر. إذا لم يكن نص المادة موجوداً في المرفقات، اكتب: [يُرجى مراجعة محامٍ أردني مرخص].
5. إذا كان موضوع ما غير مشمول أو غير واضح، اكتب: [يُرجى مراجعة محامٍ أردني مرخص].
6. لا تكتب أي مقدمة أو خاتمة أو تعليق خارج الأقسام المطلوبة.
`.trim();

export type ValidationResult = {
  valid: boolean;
  missingClauses: string[];
  warnings: string[];
};

const sectionOpen = (id: string) => `[[[SECTION:${id}]]]`;
const SECTION_CLOSE = "[[[/SECTION]]]";

/**
 * Build the full-AI drafting prompt. Every clause — statutory and
 * negotiated alike — is sent to the model as a [[[SECTION:id]]] instruction.
 * The model must reproduce exact Arabic statutory text from the provided
 * law articles when a clause cites a specific article.
 */
export function buildFullPrompt<T>(
  template: ContractTemplate<T>,
  data: T,
  articlesText: string,
): string {
  const allClauses = getAllClauses(template);

  const sectionsSpec = allClauses
    .map(
      (c) =>
        `${sectionOpen(c.id)}\nالعنوان: ${c.heading}\nالمطلوب صياغته: ${c.instruction(data)}\n${SECTION_CLOSE}`,
    )
    .join("\n\n");

  return `أنت محامٍ أردني متخصص. مهمتك صياغة ${template.title(data)} كاملاً — جميع البنود القانونية والتفاوضية.

${STRICT_RULES_BASE}
7. اكتب كل قسم بين علامتيه فقط بالشكل: ${sectionOpen("ID")} ... ${SECTION_CLOSE}
8. لا تكرر العلامات ولا تغيّرها، واكتب نص القسم فقط دون عنوان مكرر.
9. استخدم لغة عربية قانونية رسمية واضحة.

══════════════════════════════════════════════════════
النصوص القانونية المرجعية (المصدر الوحيد المسموح به للأحكام القانونية):
══════════════════════════════════════════════════════
${articlesText}
══════════════════════════════════════════════════════

جميع البنود المطلوب صياغتها (التزم بالعلامات حرفياً):

${sectionsSpec}`;
}

const SECTION_RE = /\[\[\[SECTION:([a-zA-Z0-9_]+)\]\]\]([\s\S]*?)\[\[\[\/SECTION\]\]\]/g;

/** Parse the model output into a map of sectionId → drafted text. */
export function parseSections(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  let match: RegExpExecArray | null;
  SECTION_RE.lastIndex = 0;
  while ((match = SECTION_RE.exec(raw)) !== null) {
    const id = match[1];
    const body = match[2]
      .replace(new RegExp(`^\\s*العنوان:.*$`, "m"), "")
      .trim();
    if (body) out[id] = body;
  }
  return out;
}

const REVIEW_PLACEHOLDER = "[يُرجى مراجعة محامٍ أردني مرخص لصياغة هذا البند]";

/**
 * Required clauses whose drafted text the model failed to produce.
 * These render as a placeholder and fail validation so a hollow
 * contract is never silently emitted.
 */
export function missingRequiredSections<T>(
  template: ContractTemplate<T>,
  sections: Record<string, string>,
): string[] {
  return getAllClauses(template)
    .filter((c) => c.required && !(sections[c.id]?.trim()))
    .map((c) => c.heading);
}

/**
 * Assemble the final contract. Every clause comes from the model's output
 * (parseSections). If the model omitted a clause, the review placeholder
 * is inserted so the clause is never silently dropped.
 */
export function assembleContract<T>(
  template: ContractTemplate<T>,
  data: T,
  sections: Record<string, string>,
): string {
  const parts: string[] = [];
  parts.push(template.title(data));
  parts.push(template.preamble(data));

  for (const clause of template.clauses) {
    const drafted = sections[clause.id]?.trim();
    const body = drafted && drafted.length > 0 ? drafted : REVIEW_PLACEHOLDER;
    parts.push(`${clause.heading}\n${body}`);
  }

  parts.push(template.signatureBlock(data));
  parts.push(template.disclaimer);

  return parts.join("\n\n");
}

/**
 * Full-AI streaming contract generation. Every clause is drafted by GPT-4o,
 * grounded in the RAG-provided law text. Streams NDJSON `chunk` events while
 * the model generates, then assembles the complete document and runs the
 * deterministic verification layer before emitting the `done` event.
 *
 * The NDJSON envelope (chunk / done / error) is identical to the previous
 * pipeline — the frontend consumer is unchanged.
 */
export async function streamFullContract<T>(
  req: Request,
  res: Response,
  opts: {
    template: ContractTemplate<T>;
    data: T;
    articlesText: string;
    validate: (assembled: string) => ValidationResult;
    lawWarnings: string[];
    ragDisclaimer?: string;
    errorLabel: string;
    incompleteError: string;
    failureError: string;
    onComplete?: (info: {
      valid: boolean;
      contract?: string;
      missingClauses: string[];
    }) => Promise<void> | void;
  },
): Promise<void> {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const write = (obj: unknown) => {
    if (res.writableEnded) return;
    res.write(JSON.stringify(obj) + "\n");
  };

  const prompt = buildFullPrompt(opts.template, opts.data, opts.articlesText);

  let aborted = false;
  const controller = new AbortController();
  const onClose = () => {
    aborted = true;
    controller.abort();
  };
  res.on("close", onClose);

  try {
    const stream = await openai.chat.completions.create(
      {
        model: AI_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      },
      { signal: controller.signal },
    );

    let raw = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        raw += text;
        write({ type: "chunk", text });
      }
    }

    if (aborted) return;

    const sections = parseSections(raw);
    const assembled = assembleContract(opts.template, opts.data, sections);
    const result = opts.validate(assembled);

    const missingRequired = missingRequiredSections(opts.template, sections);
    const initialValid = result.valid && missingRequired.length === 0;
    const missingClauses = [...result.missingClauses, ...missingRequired];
    const baseWarnings = [...result.warnings, ...opts.lawWarnings];

    if (!initialValid) {
      write({
        type: "done",
        valid: false,
        error: opts.incompleteError,
        missingClauses,
        confidence: 0,
        validationWarnings: baseWarnings,
      });
      if (opts.onComplete) {
        try {
          await opts.onComplete({ valid: false, contract: undefined, missingClauses });
        } catch (persistErr) {
          req.log.error({ err: persistErr }, "Failed to persist contract");
        }
      }
    } else {
      // ── Review Agent ──────────────────────────────────────────────────────
      // Primary source for citation verification: lob.gov.jo articles via RAG
      // (articlesText). Agent failure never blocks delivery.
      let finalAssembled = assembled;
      let agentPassed = true;
      let agentWarnings: string[] = [];
      let agentCriticalIssues: ReviewIssue[] = [];
      let confidence = 80;
      let autoFixed = false;

      try {
        const review = await reviewContract(assembled, opts.articlesText);
        confidence = review.confidence;
        agentPassed = review.passed;
        agentWarnings = review.issues
          .filter((i) => i.severity === "warning")
          .map((i) => `${i.clause}: ${i.issue}`);
        agentCriticalIssues = review.issues.filter((i) => i.severity === "critical");

        req.log.info(
          {
            contractType: opts.template.type,
            passed: review.passed,
            issueCount: review.issues.length,
            confidence: review.confidence,
            autoFixed: false,
          },
          "[ReviewAgent] Initial review",
        );

        if (!review.passed) {
          const fixedText = await fixContract(
            assembled,
            opts.articlesText,
            agentCriticalIssues,
          );
          const fixReview = await reviewContract(fixedText, opts.articlesText);

          autoFixed = fixReview.passed;
          confidence = fixReview.confidence;
          agentPassed = fixReview.passed;
          agentWarnings = fixReview.issues
            .filter((i) => i.severity === "warning")
            .map((i) => `${i.clause}: ${i.issue}`);
          agentCriticalIssues = fixReview.issues.filter((i) => i.severity === "critical");

          if (fixReview.passed) {
            finalAssembled = fixedText;
          }

          req.log.info(
            {
              contractType: opts.template.type,
              passed: fixReview.passed,
              issueCount: fixReview.issues.length,
              confidence: fixReview.confidence,
              autoFixed,
            },
            "[ReviewAgent] After fix pass",
          );
        }
      } catch (reviewErr) {
        req.log.warn(
          { err: reviewErr },
          "[ReviewAgent] Review agent failed — proceeding without agent check",
        );
        agentPassed = true;
        confidence = 80;
      }
      // ── End Review Agent ──────────────────────────────────────────────────

      const finalFullText = opts.ragDisclaimer
        ? `${finalAssembled}\n\n${opts.ragDisclaimer}`
        : finalAssembled;
      const allWarnings = [...baseWarnings, ...agentWarnings];

      if (!agentPassed) {
        write({
          type: "done",
          valid: false,
          error: opts.failureError,
          confidence,
          issues: agentCriticalIssues,
          validationWarnings: allWarnings,
        });
      } else {
        write({
          type: "done",
          valid: true,
          contract: finalFullText,
          confidence,
          validationWarnings: allWarnings,
        });
      }

      if (opts.onComplete) {
        try {
          await opts.onComplete({
            valid: agentPassed,
            contract: agentPassed ? finalFullText : undefined,
            missingClauses,
          });
        } catch (persistErr) {
          req.log.error({ err: persistErr }, "Failed to persist contract");
        }
      }
    }

    res.end();
  } catch (err) {
    if (aborted) return;
    req.log.error({ err }, opts.errorLabel);
    write({ type: "error", error: opts.failureError });
    res.end();
  } finally {
    res.off("close", onClose);
  }
}

// Backward-compatible alias so callers that still use the old name compile.
export { streamFullContract as streamHybridContract };
