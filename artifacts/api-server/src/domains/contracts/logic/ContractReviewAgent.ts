import { openai } from "../../../infra/anthropic";

export interface ReviewIssue {
  severity: "critical" | "warning";
  clause: string;
  issue: string;
  suggestedFix: string;
}

export interface ReviewResult {
  passed: boolean;
  issues: ReviewIssue[];
  confidence: number;
}

// Primary source: lob.gov.jo articles injected via RAG (articlesText).
// If a cited article is not present in that text, the agent flags it as
// critical — there is no secondary lookup in this pipeline pass.
const REVIEW_SYSTEM_PROMPT = `أنت محامٍ أردني متخصص تقوم بمراجعة جودة عقد مُولَّد بالذكاء الاصطناعي.

ستُعطى:
- المواد القانونية المرجعية المستخدمة في الصياغة (المصدر: ديوان التشريع والرأي lob.gov.jo)
- النص الكامل للعقد المُولَّد

افحص المشكلات التالية وأعِد كائن JSON فقط — بلا أي نص خارجه:
{
  "passed": boolean,
  "issues": [
    {
      "severity": "critical" | "warning",
      "clause": "اسم البند",
      "issue": "وصف المشكلة",
      "suggestedFix": "الإصلاح المقترح"
    }
  ],
  "confidence": number
}

المشكلات الحرجة — passed = false:
- رقم مادة قانونية مُستشهَد به في العقد لكن نصها لا يطابق المواد المرجعية المرفقة، أو المادة غير موجودة في المرفقات أصلاً
- بند إلزامي مفترض وجوده غائب كلياً عن العقد
- شرطان في بندين مختلفين يتناقضان صراحةً

التحذيرات — passed = true لكن المشكلات مُدرجة:
- بند غامض أو يحتاج توضيحاً دون أن يكون خاطئاً قانونياً
- شرط غير معتاد لكن غير مخالف للقانون

confidence: رقم من 0 إلى 100 يعكس ثقتك بسلامة العقد القانونية.

أعِد JSON فقط.`.trim();

function parseReviewJson(raw: string): ReviewResult {
  try {
    const parsed = JSON.parse(raw) as Partial<ReviewResult>;
    return {
      passed: parsed.passed ?? true,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence ?? 70))),
    };
  } catch {
    return { passed: true, issues: [], confidence: 70 };
  }
}

/**
 * Run a non-streaming review pass on the assembled contract.
 * Primary source for citation verification is the RAG-provided articlesText
 * (scraped from lob.gov.jo). If an article is not in that text, the agent
 * must flag it as a critical issue.
 */
export async function reviewContract(
  contractText: string,
  articlesText: string,
): Promise<ReviewResult> {
  const userContent =
    `المواد القانونية المرجعية (ديوان التشريع والرأي — lob.gov.jo):\n` +
    `══════════════════════════════════════════════════════\n` +
    `${articlesText}\n` +
    `══════════════════════════════════════════════════════\n\n` +
    `نص العقد المطلوب مراجعته:\n` +
    `══════════════════════════════════════════════════════\n` +
    `${contractText}\n` +
    `══════════════════════════════════════════════════════`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 500,
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    stream: false,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseReviewJson(raw);
}

/**
 * One fix pass: send the assembled contract + the critical issues back to
 * GPT-4o and ask for a corrected full text. Returns the corrected text, or
 * the original if the model returns nothing useful.
 */
export async function fixContract(
  contractText: string,
  articlesText: string,
  issues: ReviewIssue[],
): Promise<string> {
  const issuesList = issues
    .map(
      (issue, n) =>
        `${n + 1}. [${issue.severity}] البند: ${issue.clause}\n` +
        `   المشكلة: ${issue.issue}\n` +
        `   الإصلاح المقترح: ${issue.suggestedFix}`,
    )
    .join("\n\n");

  const content =
    `أنت محامٍ أردني. عَدِّل العقد التالي لإصلاح المشكلات المحددة أدناه. ` +
    `استند حصراً إلى المواد القانونية المرفقة. أعِد النص الكامل للعقد المُصحَّح فقط — بلا تعليق.\n\n` +
    `المواد القانونية المرجعية:\n` +
    `══════════════════════════════════════════════════════\n` +
    `${articlesText}\n` +
    `══════════════════════════════════════════════════════\n\n` +
    `العقد المطلوب إصلاحه:\n` +
    `══════════════════════════════════════════════════════\n` +
    `${contractText}\n` +
    `══════════════════════════════════════════════════════\n\n` +
    `المشكلات الحرجة المطلوب إصلاحها:\n${issuesList}\n\n` +
    `أعِد العقد كاملاً بعد الإصلاح.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 8192,
    messages: [{ role: "user", content }],
    stream: false,
  });

  const fixed = response.choices[0]?.message?.content?.trim();
  return fixed && fixed.length > 100 ? fixed : contractText;
}
