import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// pdf-parse@1.1.1 reads a test file at module load time — lazy-load it to avoid that crash
async function getPdfParse(): Promise<(buffer: Buffer) => Promise<{ text: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
}

const reviewRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم. المقبول: PDF, DOCX, TXT"));
    }
  },
});

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const pdfParse = await getPdfParse();
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimetype === "text/plain") {
    return buffer.toString("utf-8");
  }
  throw new Error("نوع ملف غير مدعوم");
}

function buildReviewPrompt(contractText: string): string {
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

reviewRouter.post(
  "/contracts/review",
  upload.single("contract"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "لم يتم رفع أي ملف" });
      return;
    }

    let contractText: string;
    try {
      contractText = await extractText(req.file.buffer, req.file.mimetype);
    } catch {
      res.status(422).json({ error: "تعذر قراءة الملف. تأكد أنه PDF أو DOCX أو TXT سليم." });
      return;
    }

    if (contractText.trim().length < 100) {
      res.status(422).json({ error: "الملف المرفوع يبدو فارغاً أو لا يحتوي على نص قابل للقراءة" });
      return;
    }

    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: buildReviewPrompt(contractText) }],
      });

      const rawText = message.content[0].type === "text" ? message.content[0].text : "";
      const cleaned = rawText.replace(/```json|```/gi, "").trim();

      let findings: unknown[];
      try {
        findings = JSON.parse(cleaned);
        if (!Array.isArray(findings)) throw new Error("not an array");
      } catch {
        req.log.error({ rawText }, "Failed to parse review JSON from Claude");
        res.status(500).json({ error: "تعذر تحليل نتيجة المراجعة. حاول مرة أخرى." });
        return;
      }

      res.json({ findings, charCount: contractText.length, filename: req.file.originalname });
    } catch (err) {
      req.log.error({ err }, "Contract review failed");
      res.status(500).json({ error: "فشل في مراجعة العقد. يرجى المحاولة مرة أخرى." });
    }
  }
);

// Accepts plain JSON { contractText: string } — used when reviewing a just-generated contract
reviewRouter.post("/contracts/review-text", async (req, res) => {
  const { contractText } = req.body as { contractText?: string };

  if (!contractText || typeof contractText !== "string" || contractText.trim().length < 100) {
    res.status(400).json({ error: "النص مفقود أو قصير جداً" });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: buildReviewPrompt(contractText) }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = rawText.replace(/```json|```/gi, "").trim();

    let findings: unknown[];
    try {
      findings = JSON.parse(cleaned);
      if (!Array.isArray(findings)) throw new Error("not an array");
    } catch {
      req.log.error({ rawText }, "Failed to parse review-text JSON");
      res.status(500).json({ error: "تعذر تحليل نتيجة المراجعة. حاول مرة أخرى." });
      return;
    }

    res.json({ findings, charCount: contractText.length, filename: "عقد مولَّد" });
  } catch (err) {
    req.log.error({ err }, "Contract review-text failed");
    res.status(500).json({ error: "فشل في مراجعة العقد." });
  }
});

export default reviewRouter;
