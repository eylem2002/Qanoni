import { Router } from "express";
import { GenerateContractBody } from "@workspace/api-zod";
import { JORDAN_LABOR_LAW_FULL } from "./jordan-labor-law";
import { buildWordDocument } from "./word-export";
import {
  retrieveArticlesForContract,
  formatArticlesForPrompt,
} from "../../lib/law-client";
import {
  streamHybridContract,
  MIN_WAGE_JD,
  employmentTemplate,
  EMPLOYMENT_REQUIRED,
  rentalTemplate,
  RentalBody,
  RENTAL_REQUIRED,
  serviceTemplate,
  ServiceBody,
  SERVICE_REQUIRED,
  ndaTemplate,
  NdaBody,
  NDA_REQUIRED,
  supplierTemplate,
  SupplierBody,
  SUPPLIER_REQUIRED,
} from "./clauses";

const contractsRouter = Router();

/* ══════════════════════════════════════════════════════════
   SHARED UTILITIES
══════════════════════════════════════════════════════════ */

const INJECTION_PATTERNS = [
  /ignore (all |previous |above |prior )?instructions?/gi,
  /disregard (all |previous |above |prior )?instructions?/gi,
  /forget (all |previous |above |prior )?instructions?/gi,
  /you are now/gi,
  /act as (a |an )?/gi,
  /system prompt/gi,
  /\[INST\]/gi,
  /<\|system\|>/gi,
  /###\s*(instruction|system|prompt)/gi,
];

function sanitizeInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  let sanitized = value.trim();
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[محتوى غير مسموح]");
  }
  return sanitized;
  // Note: length limits are enforced by Zod schemas (.max()) before this runs
}

function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === "string" ? sanitizeInput(v) : v;
  }
  return out as T;
}

/** Deterministic verification run on the assembled whole document. */
function verifyRequiredPhrases(
  text: string,
  requiredPhrases: string[],
  minLength: number,
): { valid: boolean; missing: string[] } {
  if (text.length < minLength) {
    return { valid: false, missing: ["العقد قصير بشكل غير عادي — التوليد لم يكتمل"] };
  }
  const missing = requiredPhrases.filter((p) => !text.includes(p));
  return { valid: missing.length === 0, missing };
}

/** Fetch RAG law text for a contract type, falling back gracefully. */
async function loadArticles(
  contractType: string,
  log: { warn: (obj: object, msg: string) => void },
  fallbackText = "النصوص القانونية المرجعية غير متاحة حالياً.",
): Promise<{ articlesText: string; lawWarnings: string[] }> {
  const lawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract(contractType);
    return { articlesText: formatArticlesForPrompt(ragResult.articles), lawWarnings };
  } catch (error) {
    log.warn(
      { error: (error as Error).message, contractType },
      "Failed to retrieve articles from law system, using fallback",
    );
    lawWarnings.push("تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.");
    return { articlesText: fallbackText, lawWarnings };
  }
}

/* ══════════════════════════════════════════════════════════
   EMPLOYMENT CONTRACT
══════════════════════════════════════════════════════════ */

contractsRouter.post("/contracts/generate", async (req, res) => {
  const parsed = GenerateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.probationPeriodDays > 90) {
    res.status(400).json({ error: "فترة التجربة لا يجوز أن تتجاوز 90 يوماً وفقاً للمادة (35)" });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as typeof parsed.data;
  const { articlesText, lawWarnings } = await loadArticles("employment", req.log, JORDAN_LABOR_LAW_FULL);

  await streamHybridContract(req, res, {
    template: employmentTemplate,
    data,
    articlesText,
    validate: (assembled) => {
      const { valid, missing } = verifyRequiredPhrases(assembled, EMPLOYMENT_REQUIRED, 2000);
      const warnings: string[] = [];
      if (data.monthlySalary < MIN_WAGE_JD) {
        warnings.push(
          `الأجر (${data.monthlySalary} د.أ) أقل من الحد الأدنى القانوني (${MIN_WAGE_JD} د.أ)`,
        );
      }
      return { valid, missingClauses: missing, warnings };
    },
    lawWarnings,
    errorLabel: "Employment contract generation failed",
    incompleteError: "لم يستوفِ العقد المتطلبات القانونية",
    failureError: "فشل توليد العقد. يرجى المحاولة مرة أخرى.",
  });
});

/* ══════════════════════════════════════════════════════════
   RENTAL CONTRACT
══════════════════════════════════════════════════════════ */

contractsRouter.post("/contracts/generate-rental", async (req, res) => {
  const parsed = RentalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as typeof parsed.data;
  const { articlesText, lawWarnings } = await loadArticles("rental", req.log);

  await streamHybridContract(req, res, {
    template: rentalTemplate,
    data,
    articlesText,
    validate: (assembled) => {
      const { valid, missing } = verifyRequiredPhrases(assembled, RENTAL_REQUIRED, 1500);
      return { valid, missingClauses: missing, warnings: [] };
    },
    lawWarnings,
    errorLabel: "Rental contract generation failed",
    incompleteError: "لم يكتمل توليد العقد",
    failureError: "فشل توليد عقد الإيجار.",
  });
});

/* ══════════════════════════════════════════════════════════
   SERVICE / FREELANCE CONTRACT
══════════════════════════════════════════════════════════ */

contractsRouter.post("/contracts/generate-service", async (req, res) => {
  const parsed = ServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as typeof parsed.data;
  const { articlesText, lawWarnings } = await loadArticles("service", req.log);

  await streamHybridContract(req, res, {
    template: serviceTemplate,
    data,
    articlesText,
    validate: (assembled) => {
      const { valid, missing } = verifyRequiredPhrases(assembled, SERVICE_REQUIRED, 1500);
      return { valid, missingClauses: missing, warnings: [] };
    },
    lawWarnings,
    errorLabel: "Service contract generation failed",
    incompleteError: "لم يكتمل توليد العقد",
    failureError: "فشل توليد عقد الخدمات.",
  });
});

/* ══════════════════════════════════════════════════════════
   NDA CONTRACT
══════════════════════════════════════════════════════════ */

contractsRouter.post("/contracts/generate-nda", async (req, res) => {
  const parsed = NdaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as typeof parsed.data;
  const { articlesText, lawWarnings } = await loadArticles("nda", req.log);

  await streamHybridContract(req, res, {
    template: ndaTemplate,
    data,
    articlesText,
    validate: (assembled) => {
      const { valid, missing } = verifyRequiredPhrases(assembled, NDA_REQUIRED, 1500);
      return { valid, missingClauses: missing, warnings: [] };
    },
    lawWarnings,
    errorLabel: "NDA generation failed",
    incompleteError: "لم يكتمل توليد الاتفاقية",
    failureError: "فشل توليد اتفاقية السرية.",
  });
});

/* ══════════════════════════════════════════════════════════
   SUPPLIER CONTRACT
══════════════════════════════════════════════════════════ */

contractsRouter.post("/contracts/generate-supplier", async (req, res) => {
  const parsed = SupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as typeof parsed.data;
  const { articlesText, lawWarnings } = await loadArticles("supplier", req.log);

  await streamHybridContract(req, res, {
    template: supplierTemplate,
    data,
    articlesText,
    validate: (assembled) => {
      const { valid, missing } = verifyRequiredPhrases(assembled, SUPPLIER_REQUIRED, 1500);
      return { valid, missingClauses: missing, warnings: [] };
    },
    lawWarnings,
    errorLabel: "Supplier contract generation failed",
    incompleteError: "لم يكتمل توليد العقد",
    failureError: "فشل توليد عقد التوريد.",
  });
});

/* ══════════════════════════════════════════════════════════
   EXPORT REPORT
══════════════════════════════════════════════════════════ */

contractsRouter.post("/contracts/export-report", async (req, res) => {
  const { findings, filename } = req.body as { findings?: unknown[]; filename?: string };

  if (!findings || !Array.isArray(findings) || findings.length === 0) {
    res.status(400).json({ error: "لا توجد نتائج للتصدير" });
    return;
  }

  try {
    const { buildReportDocument } = await import("./word-export");
    const generatedDate = new Date().toLocaleDateString("ar-JO", {
      year: "numeric", month: "long", day: "numeric",
    });
    const buffer = await buildReportDocument({
      findings: findings as Parameters<typeof buildReportDocument>[0]["findings"],
      filename: filename ?? "عقد",
      generatedDate,
    });
    const safeFilename = encodeURIComponent(`تقرير-مراجعة-${filename ?? "عقد"}.docx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${safeFilename}`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Report export failed");
    res.status(500).json({ error: "فشل تصدير التقرير" });
  }
});

/* ══════════════════════════════════════════════════════════
   WORD EXPORT
══════════════════════════════════════════════════════════ */

contractsRouter.post("/contracts/export-word", async (req, res) => {
  const { contractText, contractTypeLabel, partyName } = req.body as {
    contractText?: string;
    contractTypeLabel?: string;
    partyName?: string;
  };

  if (!contractText || typeof contractText !== "string" || contractText.length < 100) {
    res.status(400).json({ error: "نص العقد مفقود أو قصير جداً" });
    return;
  }

  try {
    const generatedDate = new Date().toLocaleDateString("ar-JO", {
      year: "numeric", month: "long", day: "numeric",
    });

    const buffer = await buildWordDocument({
      contractText,
      contractTypeLabel: contractTypeLabel ?? "عقد",
      partyName: partyName ?? "",
      generatedDate,
    });

    const filename = encodeURIComponent(`${contractTypeLabel ?? "عقد"}-${partyName ?? "وثيقة"}.docx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Word export failed");
    res.status(500).json({ error: "فشل تصدير الوثيقة" });
  }
});

export default contractsRouter;
