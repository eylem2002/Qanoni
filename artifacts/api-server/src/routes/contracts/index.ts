import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { GenerateContractBody } from "@workspace/api-zod";
import { JORDAN_LABOR_LAW_PROVISIONS } from "./jordan-labor-law";

const contractsRouter = Router();

const REQUIRED_LEGAL_ELEMENTS = [
  { key: "قانون العمل الأردني", label: "مرجع قانون العمل الأردني" },
  { key: "رقم (8) لسنة 1996", label: "رقم القانون (8) لسنة 1996" },
  { key: "الراتب", label: "بند الراتب" },
  { key: "الإجازة", label: "بند الإجازات" },
  { key: "إنهاء", label: "بند إنهاء العقد" },
  { key: "التوقيع", label: "خانة التوقيعات" },
];

function validateContract(text: string): {
  valid: boolean;
  missingClauses: string[];
  warnings: string[];
} {
  const missingClauses: string[] = [];
  const warnings: string[] = [];

  for (const element of REQUIRED_LEGAL_ELEMENTS) {
    if (!text.includes(element.key)) {
      missingClauses.push(element.label);
    }
  }

  if (text.length < 2000) {
    warnings.push("العقد قصير بشكل غير عادي — تحقق من اكتمال البنود");
  }

  return {
    valid: missingClauses.length === 0,
    missingClauses,
    warnings,
  };
}

function buildPrompt(data: {
  employerName: string;
  employeeName: string;
  jobTitle: string;
  monthlySalary: number;
  startDate: string;
  employmentType: string;
  probationPeriodDays: number;
  annualLeaveDays: number;
  hasBonus: boolean;
  hasOvertime: boolean;
  specialConditions?: string;
}): string {
  const bonusText = data.hasBonus
    ? "يحق للموظف الحصول على مكافأة أداء سنوية تُحدَّد بناءً على تقييم الأداء السنوي."
    : "لا تشمل هذه الوظيفة مكافأة أداء.";

  const overtimeText = data.hasOvertime
    ? `ينطبق العمل الإضافي وفقاً للمادة (57) من قانون العمل الأردني رقم (8) لسنة 1996: لا تزيد ساعات العمل الإضافي على ساعتين يومياً، ويُحتسب أجرها بنسبة (125%) من الأجر الاعتيادي في أيام العمل، و(150%) في أيام الراحة والعطل الرسمية.`
    : "لا ينطبق نظام العمل الإضافي على هذه الوظيفة.";

  const specialText = data.specialConditions?.trim()
    ? `شروط خاصة إضافية متفق عليها بين الطرفين: ${data.specialConditions}`
    : "لا توجد شروط خاصة إضافية.";

  return `أنت كاتب عدل قانوني أردني متخصص. مهمتك صياغة عقد عمل رسمي.

══════════════════════════════════════════════════════
قواعد صارمة يجب الالتزام بها:
══════════════════════════════════════════════════════
1. استخدم فقط النصوص القانونية المرفقة أدناه كمصدر للمعلومات القانونية.
2. لا تخترع أي مادة قانونية أو رقم مادة أو حكم غير موجود في النص المرفق.
3. لا تُضف أي معلومة قانونية من عندك — فقط ما هو مدوّن في النص أدناه.
4. إذا كان موضوع ما غير مشمول في النص المرفق، اكتب: "[يُرجى مراجعة محامٍ مرخص لتحديد الحكم القانوني المناسب]".
5. اذكر رقم المادة القانونية بدقة كما هو في النص المرفق عند كل بند.
6. ابدأ العقد مباشرةً بـ "عقد عمل" دون أي مقدمات أو تفسيرات.
══════════════════════════════════════════════════════

══════════════════════════════════════════════════════
النص القانوني المرجعي الوحيد المسموح الاستناد إليه:
══════════════════════════════════════════════════════
${JORDAN_LABOR_LAW_PROVISIONS}
══════════════════════════════════════════════════════

══════════════════════════════════════════════════════
بيانات العقد المطلوب صياغته:
══════════════════════════════════════════════════════
- صاحب العمل: ${data.employerName}
- الموظف: ${data.employeeName}
- المسمى الوظيفي: ${data.jobTitle}
- الراتب الشهري: ${data.monthlySalary} دينار أردني
- تاريخ البدء: ${data.startDate}
- نوع العقد: ${data.employmentType}
- فترة التجربة: ${data.probationPeriodDays} يوماً (وفقاً للمادة 14 من القانون)
- الإجازة السنوية: ${data.annualLeaveDays} يوم عمل (وفقاً للمادة 61 من القانون)
- مكافأة الأداء: ${bonusText}
- العمل الإضافي: ${overtimeText}
- شروط خاصة: ${specialText}
══════════════════════════════════════════════════════

اكتب العقد الآن وفق الهيكل التالي، مستنداً فقط إلى النص القانوني أعلاه:

عقد عمل

البند الأول: أطراف العقد
[اسم صاحب العمل واسم الموظف والمسمى الوظيفي]

البند الثاني: مدة العقد ونوعه
[نوع العقد وتاريخ البدء]

البند الثالث: فترة التجربة
[مستنداً إلى المادة (14) من النص المرفق حصراً]

البند الرابع: الراتب
[الراتب الشهري وموعد صرفه]

البند الخامس: ساعات العمل
[مستنداً إلى المادة (52) من النص المرفق حصراً]

البند السادس: العمل الإضافي
[مستنداً إلى المادة (57) من النص المرفق حصراً]

البند السابع: الإجازة السنوية
[مستنداً إلى المادة (61) من النص المرفق حصراً]

البند الثامن: الإجازة المرضية
[مستنداً إلى المادة (65) من النص المرفق حصراً]

البند التاسع: مكافأة نهاية الخدمة
[مستنداً إلى المادة (32) من النص المرفق حصراً]

البند العاشر: إنهاء العقد
[مستنداً إلى المادتين (21) و(28) من النص المرفق حصراً]

البند الحادي عشر: الضمان الاجتماعي
[مستنداً إلى المادة (74) من النص المرفق حصراً]

البند الثاني عشر: فض النزاعات
[مستنداً إلى المادة (77) من النص المرفق حصراً]

البند الثالث عشر: المكافأة والشروط الخاصة
[${bonusText} — ${specialText}]

البند الرابع عشر: التوقيعات
صاحب العمل: ___________________    التاريخ: ___________
الموظف: ___________________         التاريخ: ___________

تنبيه: هذا العقد مُولَّد بمساعدة الذكاء الاصطناعي استناداً إلى قانون العمل الأردني رقم (8) لسنة 1996. يُنصح بمراجعة محامٍ أردني مرخص قبل التوقيع.`;
}

contractsRouter.post("/contracts/generate", async (req, res) => {
  const parsed = GenerateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: buildPrompt(parsed.data) }],
    });

    const block = message.content[0];
    const contractText = block.type === "text" ? block.text : "";

    const validation = validateContract(contractText);

    if (!validation.valid) {
      res.status(422).json({
        error: "لم يستوفِ العقد المُوَلَّد جميع المتطلبات القانونية",
        missingClauses: validation.missingClauses,
      });
      return;
    }

    res.json({
      contract: contractText,
      validationWarnings: validation.warnings,
    });
  } catch (err) {
    req.log.error({ err }, "Contract generation failed");
    res
      .status(500)
      .json({ error: "فشل في توليد العقد. يرجى المحاولة مرة أخرى." });
  }
});

export default contractsRouter;
