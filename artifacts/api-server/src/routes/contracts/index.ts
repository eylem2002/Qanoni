import { Router } from "express";
import * as z from "zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { GenerateContractBody } from "@workspace/api-zod";
import { JORDAN_LABOR_LAW_FULL } from "./jordan-labor-law";
import { buildWordDocument } from "./word-export";
import {
  retrieveArticlesForContract,
  formatArticlesForPrompt,
} from "../../lib/law-client";

const contractsRouter = Router();

const MIN_WAGE_JD = 290;
const AI_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

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

const STRICT_RULES_BASE = `
القواعد الصارمة — يجب الالتزام بها حرفياً:
1. لا تستخدم أي رموز تعبيرية (Emoji) في أي جزء من العقد — ممنوع منعاً باتاً.
2. لا تخترع نصوصاً قانونية غير موجودة.
3. أشر إلى رقم المادة القانونية في كل حكم.
4. إذا كان موضوع ما غير مشمول، اكتب: [يُرجى مراجعة محامٍ أردني مرخص].
5. ابدأ مباشرةً بعنوان العقد دون أي مقدمة أو تعليق.
`.trim();

/* ══════════════════════════════════════════════════════════
   EMPLOYMENT CONTRACT
══════════════════════════════════════════════════════════ */

const REQUIRED_LEGAL_ELEMENTS = [
  { key: "قانون العمل الأردني", label: "مرجع قانون العمل الأردني" },
  { key: "رقم (8) لسنة 1996", label: "رقم القانون (8) لسنة 1996" },
  { key: "الراتب", label: "بند الراتب" },
  { key: "الإجازة", label: "بند الإجازات" },
  { key: "إنهاء", label: "بند إنهاء العقد" },
  { key: "التوقيع", label: "خانة التوقيعات" },
];

function validateEmploymentContract(text: string, salary: number) {
  const missingClauses: string[] = [];
  const warnings: string[] = [];
  for (const el of REQUIRED_LEGAL_ELEMENTS) {
    if (!text.includes(el.key)) missingClauses.push(el.label);
  }
  if (text.length < 2000) warnings.push("العقد قصير بشكل غير عادي — تحقق من اكتمال البنود");
  if (salary < MIN_WAGE_JD)
    warnings.push(`الراتب (${salary} د.أ) أقل من الحد الأدنى القانوني (${MIN_WAGE_JD} د.أ)`);
  return { valid: missingClauses.length === 0, missingClauses, warnings };
}

function buildEmploymentPrompt(data: {
  employerName: string; employerRegistrationNumber?: string;
  employeeName: string; employeeId: string;
  jobTitle: string; department?: string; directManager?: string;
  monthlySalary: number; startDate: string; employmentType: string;
  probationPeriodDays: number; noticePeriod: string;
  annualLeaveDays: number; hasBonus: boolean; hasOvertime: boolean;
  benefits?: string[]; hasConfidentialityClause: boolean;
  ipRights?: string; workLocation?: string; specialConditions?: string;
}, articlesText: string): string {
  const probationText =
    data.probationPeriodDays === 0
      ? "لا تُطبَّق فترة تجربة على هذا العقد."
      : `فترة التجربة: ${data.probationPeriodDays} يوماً — وفقاً للمادة (35).`;

  const benefitsList = data.benefits?.length
    ? data.benefits.join("، ")
    : "لا توجد مزايا إضافية خارج الراتب الأساسي.";

  const salaryWarn =
    data.monthlySalary < MIN_WAGE_JD
      ? `تحذير: الراتب أقل من الحد الأدنى (${MIN_WAGE_JD} د.أ) — أدرج هذا التحذير في العقد.`
      : "";

  return `أنت كاتب عدل قانوني أردني متخصص. مهمتك صياغة عقد عمل رسمي استناداً إلى النص القانوني المرفق فقط.

${STRICT_RULES_BASE}
6. لا تستخدم معلوماتك الخاصة — فقط النص المرفق هو المصدر.
7. ابدأ مباشرةً بـ"عقد عمل" دون أي مقدمة.

══════════════════════════════════════════════════════
النص القانوني المرجعي الوحيد:
══════════════════════════════════════════════════════
${articlesText}
══════════════════════════════════════════════════════

بيانات العقد:
صاحب العمل: ${data.employerName}${data.employerRegistrationNumber ? ` — رقم التسجيل: ${data.employerRegistrationNumber}` : ""}
الموظف: ${data.employeeName} — رقم الهوية: ${data.employeeId}
المسمى الوظيفي: ${data.jobTitle}${data.department ? ` — القسم: ${data.department}` : ""}${data.directManager ? ` — المشرف: ${data.directManager}` : ""}
الراتب: ${data.monthlySalary} د.أ شهرياً${salaryWarn ? " (" + salaryWarn + ")" : ""}
تاريخ البدء: ${data.startDate} — نوع العقد: ${data.employmentType}
${probationText}
فترة الإشعار: ${data.noticePeriod} — وفق المادة (21)
الإجازة السنوية: ${data.annualLeaveDays} يوم — وفق المادة (61)
مكان العمل: ${data.workLocation || "حضوري في مقر الشركة"}
العمل الإضافي: ${data.hasOvertime ? "ينطبق وفق المادة (57)" : "لا ينطبق"}
مكافأة الأداء: ${data.hasBonus ? "مشمولة" : "غير مشمولة"}
المزايا: ${benefitsList}
السرية: ${data.hasConfidentialityClause ? "يتضمن بند سرية" : "لا يتضمن"}
حقوق الملكية الفكرية: ${data.ipRights || "وفق القانون الأردني"}
شروط خاصة: ${data.specialConditions?.trim() || "لا توجد"}

اكتب العقد في الأجزاء التالية مع الاستناد الصريح لرقم المادة في كل بند:

عقد عمل

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الأول: بيانات الطرفين
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
البند الأول: صاحب العمل | البند الثاني: الموظف

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الثاني: شروط العمل
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
البند الثالث: نوع العقد ومدته | البند الرابع: فترة التجربة (م.35) | البند الخامس: فترة الإشعار (م.21) | البند السادس: ساعات العمل ومكانه (م.56) | البند السابع: العمل الإضافي (م.57)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الثالث: الراتب والمزايا
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
البند الثامن: الراتب الشهري (م.46) | البند التاسع: مكافأة الأداء | البند العاشر: المزايا والتأمينات (م.74، م.33)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الرابع: الحقوق والالتزامات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
البند الحادي عشر: الإجازة السنوية (م.61) | البند الثاني عشر: الإجازة المرضية (م.65) | البند الثالث عشر: إجازة الأمومة (م.70) | البند الرابع عشر: السلامة المهنية (م.71-85) | البند الخامس عشر: السرية | البند السادس عشر: حقوق الملكية الفكرية

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الخامس: إنهاء العقد والشروط النهائية
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
البند السابع عشر: إنهاء العقد وبدل الإشعار (م.21، م.25) | البند الثامن عشر: الفصل الفوري المشروع (م.23) | البند التاسع عشر: مكافأة نهاية الخدمة (م.32) | البند العشرون: فض النزاعات (م.77) | البند الحادي والعشرون: شروط خاصة | البند الثاني والعشرون: أحكام عامة

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
المراجع القانونية: م.15 | م.21 | م.23 | م.25 | م.28 | م.32 | م.33 | م.35 | م.46 | م.56 | م.57 | م.61 | م.65 | م.70 | م.74 | م.77

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
التوقيعات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
صاحب العمل: ___________________________    التاريخ: ________________
الموظف: ___________________________         التاريخ: ________________

─────────────────────────────────────────────────────
تنبيه: هذا العقد مُولَّد بمساعدة الذكاء الاصطناعي استناداً لقانون العمل الأردني رقم (8) لسنة 1996. يُنصح بمراجعة محامٍ أردني مرخص قبل التوقيع.`;
}

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
  let articlesText = JORDAN_LABOR_LAW_FULL;
  const lawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract("employment");
    articlesText = formatArticlesForPrompt(ragResult.articles);
  } catch (error) {
    req.log.warn({ error: (error as Error).message }, "Failed to retrieve articles from law system, using fallback");
    lawWarnings.push("تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.");
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildEmploymentPrompt(data, articlesText) }],
    });
    const contractText = msg.content[0].type === "text" ? msg.content[0].text : "";
    const validation = validateEmploymentContract(contractText, data.monthlySalary);
    if (!validation.valid) {
      res.status(422).json({
        error: "لم يستوفِ العقد المتطلبات القانونية",
        missingClauses: validation.missingClauses,
      });
      return;
    }
    res.json({ contract: contractText, validationWarnings: [...validation.warnings, ...lawWarnings] });
  } catch (err) {
    req.log.error({ err }, "Employment contract generation failed");
    res.status(500).json({ error: "فشل توليد العقد. يرجى المحاولة مرة أخرى." });
  }
});

/* ══════════════════════════════════════════════════════════
   RENTAL CONTRACT
══════════════════════════════════════════════════════════ */

const RentalBody = z.object({
  landlordName: z.string().min(2).max(200),
  tenantName: z.string().min(2).max(200),
  propertyAddress: z.string().min(4).max(500),
  propertyType: z.enum(["شقة", "فيلا", "محل تجاري", "مستودع", "مكتب"]),
  monthlyRent: z.coerce.number().positive().max(1_000_000),
  contractDurationMonths: z.coerce.number().int().min(1).max(120).default(12),
  startDate: z.string().min(2).max(50),
  depositAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  paymentDayOfMonth: z.coerce.number().int().min(1).max(28).default(1),
  furnitureStatus: z.enum(["مفروش", "نصف مفروش", "غير مفروش"]),
  specialConditions: z.string().max(1000).optional(),
});

const RENTAL_REQUIRED = ["المؤجر", "المستأجر", "الإيجار", "التوقيع"];

function validateGenericContract(text: string, requiredPhrases: string[]): { valid: boolean; missing: string[] } {
  if (text.length < 1500) return { valid: false, missing: ["العقد قصير جداً — التوليد لم يكتمل"] };
  const missing = requiredPhrases.filter((p) => !text.includes(p));
  return { valid: missing.length === 0, missing };
}

function buildRentalPrompt(d: z.infer<typeof RentalBody>, articlesText?: string): string {
  return `أنت كاتب عدل أردني متخصص في عقود الإيجار.
صِغ عقد إيجار رسمياً استناداً إلى القانون المدني الأردني رقم (43) لسنة 1976 وتعديلاته وقانون إيجار العقارات الأردني رقم (11) لسنة 1994 وتعديلاته.

${STRICT_RULES_BASE}
6. ضمّن بنداً واضحاً لآلية الإخلاء وفترة الإشعار (شهر كحد أدنى وفق القانون).
7. ضمّن بنداً لحالات فسخ العقد من قِبل كل طرف.
8. ضمّن بنداً للصيانة: الكبيرة على المؤجر، الصغيرة على المستأجر.
${articlesText ? `\n══════════════════════════════════════════════════════\nالنصوص القانونية المرجعية:\n══════════════════════════════════════════════════════\n${articlesText}\n══════════════════════════════════════════════════════\n` : ""}
بيانات العقد:
المؤجر: ${d.landlordName}
المستأجر: ${d.tenantName}
العقار: ${d.propertyAddress} — النوع: ${d.propertyType} — الحالة: ${d.furnitureStatus}
الإيجار الشهري: ${d.monthlyRent} دينار أردني — يُدفع في اليوم ${d.paymentDayOfMonth} من كل شهر
مبلغ التأمين: ${d.depositAmount} دينار أردني (يُسترد عند إخلاء العقار بحالة جيدة)
مدة العقد: ${d.contractDurationMonths} شهراً — ابتداءً من ${d.startDate}
شروط خاصة: ${d.specialConditions?.trim() || "لا توجد"}

اكتب العقد في الأجزاء: بيانات الطرفين / العقار / شروط الإيجار والدفع / التزامات الطرفين / فسخ العقد وإنهاؤه / أحكام ختامية / التوقيعات.`;
}

contractsRouter.post("/contracts/generate-rental", async (req, res) => {
  const parsed = RentalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as z.infer<typeof RentalBody>;
  let rentalArticlesText: string | undefined;
  const rentalLawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract("rental");
    rentalArticlesText = formatArticlesForPrompt(ragResult.articles);
  } catch (error) {
    req.log.warn({ error: (error as Error).message }, "Failed to retrieve rental articles from law system, using fallback");
    rentalLawWarnings.push("تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.");
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildRentalPrompt(data, rentalArticlesText) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    const { valid, missing } = validateGenericContract(contract, RENTAL_REQUIRED);
    if (!valid) {
      res.status(422).json({ error: "لم يكتمل توليد العقد", missingClauses: missing });
      return;
    }
    res.json({ contract, validationWarnings: rentalLawWarnings });
  } catch (err) {
    req.log.error({ err }, "Rental contract generation failed");
    res.status(500).json({ error: "فشل توليد عقد الإيجار." });
  }
});

/* ══════════════════════════════════════════════════════════
   SERVICE / FREELANCE CONTRACT
══════════════════════════════════════════════════════════ */

const ServiceBody = z.object({
  clientName: z.string().min(2).max(200),
  providerName: z.string().min(2).max(200),
  serviceDescription: z.string().min(10).max(2000),
  totalFee: z.coerce.number().positive().max(10_000_000),
  paymentTerms: z.string().min(2).max(200),
  deliveryDeadline: z.string().min(2).max(50),
  hasRevisions: z.boolean().default(true),
  revisionCount: z.coerce.number().int().min(0).max(20).default(2),
  ipOwnership: z.string().min(2).max(200),
  hasConfidentialityClause: z.boolean().default(true),
  specialConditions: z.string().max(1000).optional(),
});

const SERVICE_REQUIRED = ["العميل", "الخدمة", "الأتعاب", "التوقيع"];

function buildServicePrompt(d: z.infer<typeof ServiceBody>, articlesText?: string): string {
  const revisionInfo = d.hasRevisions ? `مسموح بـ ${d.revisionCount} مراجعات` : "لا تشمل مراجعات";
  const confidentialityText = d.hasConfidentialityClause
    ? "يتضمن العقد بند سرية — يلتزم مقدم الخدمة بعدم إفشاء أسرار العميل."
    : "لا يتضمن بند سرية.";

  return `أنت محامٍ أردني متخصص في عقود الخدمات والاستشارات.
صِغ عقد خدمات مهنية ملزماً وفق القانون المدني الأردني رقم (43) لسنة 1976.

${STRICT_RULES_BASE}
6. ضمّن بنداً صريحاً لاستقلالية مقدم الخدمة (ليس موظفاً).
7. ضمّن بنداً لإجراءات القبول والرفض عند التسليم.
8. ضمّن بنداً للإنهاء المبكر وتبعاته المالية.
${articlesText ? `\n══════════════════════════════════════════════════════\nالنصوص القانونية المرجعية:\n══════════════════════════════════════════════════════\n${articlesText}\n══════════════════════════════════════════════════════\n` : ""}
بيانات العقد:
العميل: ${d.clientName}
مقدم الخدمة: ${d.providerName}
وصف الخدمة: ${d.serviceDescription}
الأتعاب الإجمالية: ${d.totalFee} دينار أردني
شروط الدفع: ${d.paymentTerms}
الموعد النهائي للتسليم: ${d.deliveryDeadline}
المراجعات: ${revisionInfo}
ملكية المخرجات: ${d.ipOwnership}
بند السرية: ${confidentialityText}
شروط خاصة: ${d.specialConditions?.trim() || "لا توجد"}

اكتب العقد في الأجزاء: تعريف الطرفين / نطاق الخدمة / الجدول الزمني / الأتعاب والدفع / التسليم والقبول / الملكية الفكرية / السرية / إنهاء العقد / أحكام عامة / التوقيعات.`;
}

contractsRouter.post("/contracts/generate-service", async (req, res) => {
  const parsed = ServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as z.infer<typeof ServiceBody>;
  let serviceArticlesText: string | undefined;
  const serviceLawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract("service");
    serviceArticlesText = formatArticlesForPrompt(ragResult.articles);
  } catch (error) {
    req.log.warn({ error: (error as Error).message }, "Failed to retrieve service articles from law system, using fallback");
    serviceLawWarnings.push("تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.");
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildServicePrompt(data, serviceArticlesText) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    const { valid, missing } = validateGenericContract(contract, SERVICE_REQUIRED);
    if (!valid) {
      res.status(422).json({ error: "لم يكتمل توليد العقد", missingClauses: missing });
      return;
    }
    res.json({ contract, validationWarnings: serviceLawWarnings });
  } catch (err) {
    req.log.error({ err }, "Service contract generation failed");
    res.status(500).json({ error: "فشل توليد عقد الخدمات." });
  }
});

/* ══════════════════════════════════════════════════════════
   NDA CONTRACT
══════════════════════════════════════════════════════════ */

const NdaBody = z.object({
  partyOneName: z.string().min(2).max(200),
  partyTwoName: z.string().min(2).max(200),
  purposeOfDisclosure: z.string().min(10).max(1000),
  confidentialityDurationYears: z.coerce.number().int().min(1).max(20).default(2),
  scopeOfConfidential: z.string().min(10).max(2000),
  permittedDisclosures: z.string().max(1000).optional(),
  penaltyAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  startDate: z.string().min(2).max(50),
});

const NDA_REQUIRED = ["الطرف الأول", "الطرف الثاني", "السرية", "التوقيع"];

function buildNdaPrompt(d: z.infer<typeof NdaBody>, articlesText?: string): string {
  const penaltyText = d.penaltyAmount ? `${d.penaltyAmount} دينار أردني` : "يُحدَّد وفق تقدير المحكمة";
  const permittedText = d.permittedDisclosures?.trim() || "لا توجد إفصاحات مسموحة إضافية";

  return `أنت محامٍ أردني متخصص في اتفاقيات عدم الإفصاح.
صِغ اتفاقية سرية (NDA) ملزمة قانونياً وفق القانون المدني الأردني وقانون المنافسة وحماية أسرار التجارة.

${STRICT_RULES_BASE}
6. اجعل الاتفاقية أحادية الاتجاه (من الطرف الأول للثاني).
7. ضمّن قائمة صريحة باستثناءات السرية (المعلومات العامة، ما أُفصح بموافقة مسبقة، ما طلبته جهة قانونية).
8. ضمّن بنداً لاسترداد وإتلاف المعلومات عند انتهاء الاتفاقية.
${articlesText ? `\n══════════════════════════════════════════════════════\nالنصوص القانونية المرجعية:\n══════════════════════════════════════════════════════\n${articlesText}\n══════════════════════════════════════════════════════\n` : ""}
بيانات الاتفاقية:
الطرف الأول (المُفصِح): ${d.partyOneName}
الطرف الثاني (المُستقبِل): ${d.partyTwoName}
الغرض من الإفصاح: ${d.purposeOfDisclosure}
نطاق المعلومات السرية: ${d.scopeOfConfidential}
الإفصاحات المسموحة: ${permittedText}
مدة السرية: ${d.confidentialityDurationYears} سنوات
الغرامة عند الإخلال: ${penaltyText}
تاريخ السريان: ${d.startDate}
القانون الحاكم: القانون الأردني — المحاكم الأردنية المختصة

اكتب الاتفاقية في الأجزاء: تعريف الطرفين والغرض / تعريف المعلومات السرية / الالتزامات والقيود / الاستثناءات / مدة الاتفاقية / العقوبات والتعويض / إعادة المعلومات وإتلافها / أحكام عامة / التوقيعات.`;
}

contractsRouter.post("/contracts/generate-nda", async (req, res) => {
  const parsed = NdaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as z.infer<typeof NdaBody>;
  let ndaArticlesText: string | undefined;
  const ndaLawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract("nda");
    ndaArticlesText = formatArticlesForPrompt(ragResult.articles);
  } catch (error) {
    req.log.warn({ error: (error as Error).message }, "Failed to retrieve NDA articles from law system, using fallback");
    ndaLawWarnings.push("تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.");
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildNdaPrompt(data, ndaArticlesText) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    const { valid, missing } = validateGenericContract(contract, NDA_REQUIRED);
    if (!valid) {
      res.status(422).json({ error: "لم يكتمل توليد الاتفاقية", missingClauses: missing });
      return;
    }
    res.json({ contract, validationWarnings: ndaLawWarnings });
  } catch (err) {
    req.log.error({ err }, "NDA generation failed");
    res.status(500).json({ error: "فشل توليد اتفاقية السرية." });
  }
});

/* ══════════════════════════════════════════════════════════
   SUPPLIER CONTRACT
══════════════════════════════════════════════════════════ */

const SupplierBody = z.object({
  buyerName: z.string().min(2).max(200),
  supplierName: z.string().min(2).max(200),
  goodsOrServices: z.string().min(10).max(2000),
  totalContractValue: z.coerce.number().positive().max(100_000_000),
  paymentTerms: z.string().min(2).max(200),
  deliverySchedule: z.string().min(2).max(500),
  deliveryLocation: z.string().min(2).max(500),
  warrantyPeriodDays: z.coerce.number().int().min(0).max(3650).default(30),
  penaltyForDelay: z.coerce.number().min(0).max(100).optional(),
  hasExclusivity: z.boolean().default(false),
  specialConditions: z.string().max(1000).optional(),
});

const SUPPLIER_REQUIRED = ["المشتري", "المورد", "التوريد", "التوقيع"];

function buildSupplierPrompt(d: z.infer<typeof SupplierBody>, articlesText?: string): string {
  const penaltyText = d.penaltyForDelay
    ? `${d.penaltyForDelay}% من قيمة العقد يومياً`
    : "لا توجد غرامة تأخير محددة";
  const exclusivityText = d.hasExclusivity
    ? "العقد حصري — لا يجوز للمورد التعامل مع منافسين للمشتري خلال مدة العقد."
    : "العقد غير حصري.";

  return `أنت محامٍ أردني متخصص في عقود التوريد والمشتريات.
صِغ عقد توريد تجارياً وفق القانون المدني الأردني رقم (43) لسنة 1976 وقانون التجارة الأردني.

${STRICT_RULES_BASE}
6. ضمّن بنداً صريحاً لآلية الفحص والاستلام وحق الرفض.
7. ضمّن بنداً لانتقال المخاطر والملكية (عند التسليم في المكان المتفق).
8. ضمّن بنداً للقوة القاهرة وتعريفها.
${articlesText ? `\n══════════════════════════════════════════════════════\nالنصوص القانونية المرجعية:\n══════════════════════════════════════════════════════\n${articlesText}\n══════════════════════════════════════════════════════\n` : ""}
بيانات العقد:
المشتري: ${d.buyerName}
المورد: ${d.supplierName}
البضاعة / الخدمات: ${d.goodsOrServices}
القيمة الإجمالية: ${d.totalContractValue} دينار أردني
شروط الدفع: ${d.paymentTerms}
جدول التوريد: ${d.deliverySchedule}
مكان التسليم: ${d.deliveryLocation}
فترة الضمان: ${d.warrantyPeriodDays} يوماً
غرامة التأخير: ${penaltyText}
الحصرية: ${exclusivityText}
شروط خاصة: ${d.specialConditions?.trim() || "لا توجد"}

اكتب العقد في الأجزاء: تعريف الطرفين / موضوع العقد / جدول التوريد / الأسعار والدفع / الفحص والاستلام / الضمان / غرامات التأخير / انتقال المخاطر / القوة القاهرة / إنهاء العقد / فض النزاعات / أحكام ختامية / التوقيعات.`;
}

contractsRouter.post("/contracts/generate-supplier", async (req, res) => {
  const parsed = SupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const data = sanitizeObject(parsed.data as unknown as Record<string, unknown>) as z.infer<typeof SupplierBody>;
  let supplierArticlesText: string | undefined;
  const supplierLawWarnings: string[] = [];
  try {
    const ragResult = await retrieveArticlesForContract("supplier");
    supplierArticlesText = formatArticlesForPrompt(ragResult.articles);
  } catch (error) {
    req.log.warn({ error: (error as Error).message }, "Failed to retrieve supplier articles from law system, using fallback");
    supplierLawWarnings.push("تحذير: تم استخدام نصوص قانونية محفوظة لأن نظام القوانين غير متاح.");
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildSupplierPrompt(data, supplierArticlesText) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    const { valid, missing } = validateGenericContract(contract, SUPPLIER_REQUIRED);
    if (!valid) {
      res.status(422).json({ error: "لم يكتمل توليد العقد", missingClauses: missing });
      return;
    }
    res.json({ contract, validationWarnings: supplierLawWarnings });
  } catch (err) {
    req.log.error({ err }, "Supplier contract generation failed");
    res.status(500).json({ error: "فشل توليد عقد التوريد." });
  }
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
