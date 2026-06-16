import type { Request, Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { type ContractTemplate, getVariableClauses } from "./types";

const AI_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

export const MIN_WAGE_JD = 290;

/**
 * Strict rules shared by every drafting prompt. In the hybrid model the model
 * is responsible only for the variable sections, so these rules are scoped to
 * that narrower job.
 */
export const STRICT_RULES_BASE = `
القواعد الصارمة — يجب الالتزام بها حرفياً:
1. لا تستخدم أي رموز تعبيرية (Emoji) في أي جزء من النص — ممنوع منعاً باتاً.
2. لا تخترع نصوصاً قانونية غير موجودة. استند فقط إلى النصوص القانونية المرفقة.
3. عند الإشارة إلى حكم قانوني، اذكر رقم المادة القانونية.
4. إذا كان موضوع ما غير مشمول أو غير واضح، اكتب: [يُرجى مراجعة محامٍ أردني مرخص].
5. لا تكتب أي مقدمة أو خاتمة أو تعليق خارج الأقسام المطلوبة.
`.trim();

export type ValidationResult = {
  valid: boolean;
  missingClauses: string[];
  warnings: string[];
};

const sectionOpen = (id: string) => `[[[SECTION:${id}]]]`;
const SECTION_CLOSE = "[[[/SECTION]]]";

/**
 * Build the drafting prompt. Critically, this asks the model to draft ONLY the
 * variable sections — the mandatory/statutory clauses are injected verbatim by
 * the assembler and are never sent for generation or rewriting.
 */
export function buildHybridPrompt<T>(
  template: ContractTemplate<T>,
  data: T,
  articlesText: string,
): string {
  const variable = getVariableClauses(template);

  const sectionsSpec = variable
    .map(
      (c) =>
        `${sectionOpen(c.id)}\nالعنوان: ${c.heading}\nالمطلوب صياغته: ${c.instruction(data)}\n${SECTION_CLOSE}`,
    )
    .join("\n\n");

  return `أنت محامٍ أردني متخصص. مهمتك صياغة الأقسام المتغيّرة (القابلة للتفاوض) من ${template.title(data)} فقط.
البنود القانونية الإلزامية الثابتة مُدرجة مسبقاً في الوثيقة بنصوص معتمدة — لا تكتبها ولا تعد صياغتها.

${STRICT_RULES_BASE}
6. اكتب كل قسم بين علامتيه فقط بالشكل: ${sectionOpen("ID")} ... ${SECTION_CLOSE}
7. لا تكرر العلامات ولا تغيّرها، واكتب نص القسم فقط دون عنوان مكرر.
8. استخدم لغة عربية قانونية رسمية واضحة.

══════════════════════════════════════════════════════
النصوص القانونية المرجعية (المصدر الوحيد للأحكام القانونية):
══════════════════════════════════════════════════════
${articlesText}
══════════════════════════════════════════════════════

الأقسام المتغيّرة المطلوب صياغتها (التزم بالعلامات حرفياً):

${sectionsSpec}`;
}

const SECTION_RE = /\[\[\[SECTION:([a-zA-Z0-9_]+)\]\]\]([\s\S]*?)\[\[\[\/SECTION\]\]\]/g;

/** Parse the model output into a map of sectionId -> drafted text. */
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
 * Assemble the final contract in clause order: fixed clauses verbatim,
 * variable clauses filled with the model's drafted text (or a review
 * placeholder when missing).
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
    if (clause.kind === "fixed") {
      parts.push(`${clause.heading}\n${clause.render(data).trim()}`);
    } else {
      const drafted = sections[clause.id]?.trim();
      const body = drafted && drafted.length > 0 ? drafted : REVIEW_PLACEHOLDER;
      parts.push(`${clause.heading}\n${body}`);
    }
  }

  parts.push(template.signatureBlock(data));
  parts.push(template.disclaimer);

  return parts.join("\n\n");
}

/**
 * Hybrid streaming generation. Streams the model's variable-section drafting as
 * NDJSON `chunk` events (keeping the proxied connection alive), then assembles
 * the full document (fixed verbatim + variable) and runs the deterministic
 * verification layer on the assembled whole before emitting the `done` event.
 *
 * The NDJSON envelope (chunk / done / error, and the `done` shape) is identical
 * to the previous pure-generative pipeline so the frontend consumer is unchanged.
 */
export async function streamHybridContract<T>(
  req: Request,
  res: Response,
  opts: {
    template: ContractTemplate<T>;
    data: T;
    articlesText: string;
    validate: (assembled: string) => ValidationResult;
    lawWarnings: string[];
    errorLabel: string;
    incompleteError: string;
    failureError: string;
  },
): Promise<void> {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const write = (obj: unknown) => {
    res.write(JSON.stringify(obj) + "\n");
  };

  try {
    const prompt = buildHybridPrompt(opts.template, opts.data, opts.articlesText);
    let raw = "";
    const stream = anthropic.messages.stream({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const text = event.delta.text;
        raw += text;
        // Keepalive + progress. Final displayed document is the assembled
        // `contract` in the done event, so partial markers here are harmless.
        write({ type: "chunk", text });
      }
    }

    const sections = parseSections(raw);
    const assembled = assembleContract(opts.template, opts.data, sections);
    const result = opts.validate(assembled);

    if (!result.valid) {
      write({
        type: "done",
        valid: false,
        error: opts.incompleteError,
        missingClauses: result.missingClauses,
        validationWarnings: [...result.warnings, ...opts.lawWarnings],
      });
    } else {
      write({
        type: "done",
        valid: true,
        contract: assembled,
        validationWarnings: [...result.warnings, ...opts.lawWarnings],
      });
    }
    res.end();
  } catch (err) {
    req.log.error({ err }, opts.errorLabel);
    write({ type: "error", error: opts.failureError });
    res.end();
  }
}
