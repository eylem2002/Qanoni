/* ══════════════════════════════════════════════════════════
   REVIEW LOGIC

   Pure helpers for the contract-review flow: extract text from an
   uploaded file, build the reviewer prompt, and call the model to
   produce structured findings. HTTP concerns (multer, status codes,
   per-route error copy) stay in the controller.
══════════════════════════════════════════════════════════ */

import mammoth from "mammoth";
import { openai } from "../../../infra/anthropic";
import { AppError, UnprocessableError } from "../../../core/errors";

const REVIEW_MODEL = "gpt-4o";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ReviewLogger {
  error: (obj: object, msg: string) => void;
}

// pdf-parse@1.1.1 reads a test file at module load time — lazy-load it to avoid that crash
async function getPdfParse(): Promise<
  (buffer: Buffer) => Promise<{ text: string }>
> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
}

export async function extractText(
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
  if (mimetype === "application/pdf") {
    const pdfParse = await getPdfParse();
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (mimetype === DOCX_MIME || mimetype === "application/msword") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimetype === "text/plain") {
    return buffer.toString("utf-8");
  }
  throw new UnprocessableError("نوع ملف غير مدعوم");
}

export function buildReviewPrompt(contractText: string): string {
  return `أنت محامٍ أردني خبير في مراجعة العقود. مهمتك مراجعة العقد المرفق أدناه وتحديد المخاطر القانونية.

قواعد صارمة:
1. أجب فقط بـ JSON صحيح — لا نص قبله ولا بعده ولا backticks.
2. كل بند يجب تصنيفه إلى: "green" (آمن) أو "yellow" (غير معتاد / يحتاج مراجعة) أو "red" (مشكلة قانونية خطيرة أو بند مفقود إلزامي).
3. لا تخترع بنوداً غير موجودة في العقد.
4. إذا كان بند مفقود لكنه إلزامي قانوناً (مثل الراتب أو إنهاء العقد)، أضفه كـ red مع finding يبدأ بـ "بند مفقود:".
5. أعطِ على الأقل 6 بنود ولا تتجاوز 15 بنداً.
6. اكتب كل النصوص باللغة العربية.

أعد الرد بهذا الشكل تماماً (JSON array):
[
  {
    "status": "green" | "yellow" | "red",
    "severity": "safe" | "unusual" | "illegal",
    "clause": "اسم البند بالعربية",
    "finding": "ما وجدته في العقد — جملة أو جملتان",
    "suggestion": "الإجراء الموصى به — جملة واحدة. إذا كان آمناً اكتب: لا يلزم تغيير."
  }
]

══════════════════════════════════════════════════════
نص العقد للمراجعة:
══════════════════════════════════════════════════════
${contractText.slice(0, 12000)}
══════════════════════════════════════════════════════

أجب الآن بـ JSON فقط:`;
}

/** Calls the model and returns parsed findings. Throws AppError(500)
    when the response is not valid JSON; raw model/API errors propagate. */
export async function analyzeContract(
  contractText: string,
  log: ReviewLogger,
): Promise<unknown[]> {
  const response = await openai.chat.completions.create({
    model: REVIEW_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: buildReviewPrompt(contractText) }],
  });

  const rawText = response.choices[0]?.message?.content ?? "";
  const cleaned = rawText.replace(/```json|```/gi, "").trim();

  let findings: unknown[];
  try {
    findings = JSON.parse(cleaned);
    if (!Array.isArray(findings)) throw new Error("not an array");
  } catch {
    log.error({ rawText }, "Failed to parse review JSON from OpenAI");
    throw new AppError("تعذر تحليل نتيجة المراجعة. حاول مرة أخرى.", 500, {
      expose: true,
    });
  }
  return findings;
}
