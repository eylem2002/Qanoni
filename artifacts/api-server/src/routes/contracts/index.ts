import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { GenerateContractBody } from "@workspace/api-zod";
import { JORDAN_LABOR_LAW_FULL } from "./jordan-labor-law";

const contractsRouter = Router();

const MIN_WAGE_JD = 290;
const AI_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

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
  if (salary < MIN_WAGE_JD) warnings.push(`الراتب (${salary} د.أ) أقل من الحد الأدنى القانوني (${MIN_WAGE_JD} د.أ)`);
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
}): string {
  const probationText = data.probationPeriodDays === 0
    ? "لا تُطبَّق فترة تجربة على هذا العقد."
    : `فترة التجربة: ${data.probationPeriodDays} يوماً — وفقاً للمادة (35).`;

  const benefitsList = data.benefits?.length
    ? data.benefits.join("، ")
    : "لا توجد مزايا إضافية خارج الراتب الأساسي.";

  const salaryWarn = data.monthlySalary < MIN_WAGE_JD
    ? `تحذير: الراتب أقل من الحد الأدنى (${MIN_WAGE_JD} د.أ) — أدرج هذا التحذير في العقد.`
    : "";

  return `أنت كاتب عدل قانوني أردني متخصص. مهمتك صياغة عقد عمل رسمي استناداً إلى النص القانوني المرفق فقط.

${STRICT_RULES_BASE}
6. لا تستخدم معلوماتك الخاصة — فقط النص المرفق هو المصدر.
7. ابدأ مباشرةً بـ"عقد عمل" دون أي مقدمة.

══════════════════════════════════════════════════════
النص القانوني المرجعي الوحيد:
══════════════════════════════════════════════════════
${JORDAN_LABOR_LAW_FULL}
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
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL, max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildEmploymentPrompt(parsed.data) }],
    });
    const contractText = msg.content[0].type === "text" ? msg.content[0].text : "";
    const validation = validateEmploymentContract(contractText, parsed.data.monthlySalary);
    if (!validation.valid) {
      res.status(422).json({ error: "لم يستوفِ العقد المتطلبات القانونية", missingClauses: validation.missingClauses });
      return;
    }
    res.json({ contract: contractText, validationWarnings: validation.warnings });
  } catch (err) {
    req.log.error({ err }, "Employment contract generation failed");
    res.status(500).json({ error: "فشل توليد العقد. يرجى المحاولة مرة أخرى." });
  }
});

/* ══════════════════════════════════════════════════════════
   RENTAL CONTRACT
══════════════════════════════════════════════════════════ */

function buildRentalPrompt(d: {
  landlordName: string; tenantName: string; propertyAddress: string;
  propertyType: string; monthlyRent: number; contractDurationMonths: number;
  startDate: string; depositAmount: number; paymentDayOfMonth: number;
  furnitureStatus: string; specialConditions?: string;
}): string {
  return `أنت كاتب عدل أردني متخصص في عقود الإيجار.
صِغ عقد إيجار رسمياً استناداً إلى القانون المدني الأردني رقم (43) لسنة 1976 وتعديلاته وقانون إيجار العقارات الأردني رقم (11) لسنة 1994 وتعديلاته.

${STRICT_RULES_BASE}
6. ضمّن بنداً واضحاً لآلية الإخلاء وفترة الإشعار (شهر كحد أدنى وفق القانون).
7. ضمّن بنداً لحالات فسخ العقد من قِبل كل طرف.
8. ضمّن بنداً للصيانة: الكبيرة على المؤجر، الصغيرة على المستأجر.

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
  const d = req.body;
  if (!d.landlordName || !d.tenantName || !d.propertyAddress || !d.monthlyRent || !d.startDate) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL, max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildRentalPrompt(d) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    res.json({ contract, validationWarnings: [] });
  } catch (err) {
    req.log.error({ err }, "Rental contract generation failed");
    res.status(500).json({ error: "فشل توليد عقد الإيجار." });
  }
});

/* ══════════════════════════════════════════════════════════
   SERVICE / FREELANCE CONTRACT
══════════════════════════════════════════════════════════ */

function buildServicePrompt(d: {
  clientName: string; providerName: string; serviceDescription: string;
  totalFee: number; paymentTerms: string; deliveryDeadline: string;
  hasRevisions: boolean; revisionCount: number; ipOwnership: string;
  hasConfidentialityClause: boolean; specialConditions?: string;
}): string {
  const revisionInfo = d.hasRevisions
    ? `مسموح بـ ${d.revisionCount} مراجعات`
    : "لا تشمل مراجعات";
  const confidentialityText = d.hasConfidentialityClause
    ? "يتضمن العقد بند سرية — يلتزم مقدم الخدمة بعدم إفشاء أسرار العميل."
    : "لا يتضمن بند سرية.";

  return `أنت محامٍ أردني متخصص في عقود الخدمات والاستشارات.
صِغ عقد خدمات مهنية ملزماً وفق القانون المدني الأردني رقم (43) لسنة 1976.

${STRICT_RULES_BASE}
6. ضمّن بنداً صريحاً لاستقلالية مقدم الخدمة (ليس موظفاً).
7. ضمّن بنداً لإجراءات القبول والرفض عند التسليم.
8. ضمّن بنداً للإنهاء المبكر وتبعاته المالية.

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
  const d = req.body;
  if (!d.clientName || !d.providerName || !d.serviceDescription || !d.totalFee || !d.deliveryDeadline) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL, max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildServicePrompt(d) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    res.json({ contract, validationWarnings: [] });
  } catch (err) {
    req.log.error({ err }, "Service contract generation failed");
    res.status(500).json({ error: "فشل توليد عقد الخدمات." });
  }
});

/* ══════════════════════════════════════════════════════════
   NDA CONTRACT
══════════════════════════════════════════════════════════ */

function buildNdaPrompt(d: {
  partyOneName: string; partyTwoName: string; purposeOfDisclosure: string;
  confidentialityDurationYears: number; scopeOfConfidential: string;
  permittedDisclosures?: string; penaltyAmount?: number; startDate: string;
}): string {
  const penaltyText = d.penaltyAmount
    ? `${d.penaltyAmount} دينار أردني`
    : "يُحدَّد وفق تقدير المحكمة";
  const permittedText = d.permittedDisclosures?.trim() || "لا توجد إفصاحات مسموحة إضافية";

  return `أنت محامٍ أردني متخصص في اتفاقيات عدم الإفصاح.
صِغ اتفاقية سرية (NDA) ملزمة قانونياً وفق القانون المدني الأردني وقانون المنافسة وحماية أسرار التجارة.

${STRICT_RULES_BASE}
6. اجعل الاتفاقية أحادية الاتجاه (من الطرف الأول للثاني).
7. ضمّن قائمة صريحة باستثناءات السرية (المعلومات العامة، ما أُفصح بموافقة مسبقة، ما طلبته جهة قانونية).
8. ضمّن بنداً لاسترداد وإتلاف المعلومات عند انتهاء الاتفاقية.

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
  const d = req.body;
  if (!d.partyOneName || !d.partyTwoName || !d.purposeOfDisclosure || !d.scopeOfConfidential || !d.startDate) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL, max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildNdaPrompt(d) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    res.json({ contract, validationWarnings: [] });
  } catch (err) {
    req.log.error({ err }, "NDA generation failed");
    res.status(500).json({ error: "فشل توليد اتفاقية السرية." });
  }
});

/* ══════════════════════════════════════════════════════════
   SUPPLIER CONTRACT
══════════════════════════════════════════════════════════ */

function buildSupplierPrompt(d: {
  buyerName: string; supplierName: string; goodsOrServices: string;
  totalContractValue: number; paymentTerms: string; deliverySchedule: string;
  deliveryLocation: string; warrantyPeriodDays: number;
  penaltyForDelay?: number; hasExclusivity: boolean; specialConditions?: string;
}): string {
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
  const d = req.body;
  if (!d.buyerName || !d.supplierName || !d.goodsOrServices || !d.totalContractValue || !d.deliveryLocation) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  try {
    const msg = await anthropic.messages.create({
      model: AI_MODEL, max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildSupplierPrompt(d) }],
    });
    const contract = msg.content[0].type === "text" ? msg.content[0].text : "";
    res.json({ contract, validationWarnings: [] });
  } catch (err) {
    req.log.error({ err }, "Supplier contract generation failed");
    res.status(500).json({ error: "فشل توليد عقد التوريد." });
  }
});

export default contractsRouter;
