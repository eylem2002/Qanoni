import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { GenerateContractBody } from "@workspace/api-zod";

const contractsRouter = Router();

const REQUIRED_LEGAL_ELEMENTS = [
  { key: "قانون العمل الأردني", label: "مرجع قانون العمل الأردني" },
  { key: "رقم 8 لسنة 1996", label: "رقم القانون (8 لسنة 1996)" },
  { key: "الراتب", label: "بند الراتب" },
  { key: "الإجازة", label: "بند الإجازات" },
  { key: "الإنهاء", label: "بند إنهاء العقد" },
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
  const bonusClause = data.hasBonus
    ? "يحق للموظف الحصول على مكافأة أداء سنوية تُحدد بناءً على تقييم الأداء."
    : "لا تشمل هذه الوظيفة مكافأة أداء.";

  const overtimeClause = data.hasOvertime
    ? "يُطبّق نظام العمل الإضافي وفقاً للمادة (57) من قانون العمل الأردني رقم 8 لسنة 1996."
    : "لا يُطبّق نظام العمل الإضافي على هذه الوظيفة.";

  const specialClause = data.specialConditions?.trim()
    ? `شروط خاصة إضافية: ${data.specialConditions}`
    : "لا توجد شروط خاصة إضافية.";

  return `أنت متخصص قانوني أردني خبير في صياغة عقود العمل وفق القانون الأردني رقم 8 لسنة 1996.

مهمتك: أدخل البيانات المقدمة في هيكل العقد النموذجي أدناه. لا تخترع بنوداً قانونية جديدة. فقط أكمل الهيكل بالبيانات الصحيحة وأضف الصياغة الرسمية المناسبة.

═══════════════════════════════════════════
هيكل العقد النموذجي (أكمل كل قسم)
═══════════════════════════════════════════

عقد عمل

البند الأول: أطراف العقد
[أكمل: اسم صاحب العمل، اسم الموظف، المسمى الوظيفي]

البند الثاني: مدة العقد ونوعه
النوع: ${data.employmentType}
تاريخ البدء: ${data.startDate}
[أضف نص رسمي مناسب]

البند الثالث: فترة التجربة
مدة التجربة: ${data.probationPeriodDays} يوماً وفقاً للمادة (30) من قانون العمل الأردني رقم 8 لسنة 1996.
[أضف نص رسمي مناسب]

البند الرابع: الراتب والتعويضات
الراتب الشهري: ${data.monthlySalary} دينار أردني
${bonusClause}
[أضف تفاصيل الدفع وموعده]

البند الخامس: ساعات العمل
[أكمل: 8 ساعات يومياً، 48 ساعة أسبوعياً وفق المادة (52) من قانون العمل الأردني رقم 8 لسنة 1996]

البند السادس: الإجازات
الإجازة السنوية: ${data.annualLeaveDays} يوماً وفقاً لقانون العمل الأردني رقم 8 لسنة 1996.
[أكمل: الإجازات المرضية، إجازات الأعياد الرسمية]

البند السابع: العمل الإضافي
${overtimeClause}

البند الثامن: التزامات الطرفين
[أكمل: التزامات صاحب العمل والموظف]

البند التاسع: إنهاء العقد
[أكمل: شروط الإنهاء وفق المواد (21-29) من قانون العمل الأردني رقم 8 لسنة 1996، مدة الإشعار]

البند العاشر: فض النزاعات
[أكمل: الإحالة لمحاكم العمل الأردنية وفق القانون الأردني]

البند الحادي عشر: الشروط الخاصة
${specialClause}

البند الثاني عشر: التوقيعات
[أضف خانات التوقيع: صاحب العمل والموظف والتاريخ]

═══════════════════════════════════════════

البيانات للإدراج:
- صاحب العمل: ${data.employerName}
- الموظف: ${data.employeeName}
- المسمى الوظيفي: ${data.jobTitle}
- الراتب: ${data.monthlySalary} دينار أردني
- تاريخ البدء: ${data.startDate}
- نوع العقد: ${data.employmentType}

اكتب العقد كاملاً بصيغة رسمية قانونية. ابدأ مباشرة بـ "عقد عمل" بدون أي مقدمات أو تفسيرات.`;
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
