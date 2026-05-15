import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { GenerateContractBody } from "@workspace/api-zod";
import { JORDAN_LABOR_LAW_FULL } from "./jordan-labor-law";

const contractsRouter = Router();

const MIN_WAGE_JD = 290;

const REQUIRED_LEGAL_ELEMENTS = [
  { key: "قانون العمل الأردني", label: "مرجع قانون العمل الأردني" },
  { key: "رقم (8) لسنة 1996", label: "رقم القانون (8) لسنة 1996" },
  { key: "الراتب", label: "بند الراتب" },
  { key: "الإجازة", label: "بند الإجازات" },
  { key: "إنهاء", label: "بند إنهاء العقد" },
  { key: "التوقيع", label: "خانة التوقيعات" },
];

function validateContract(
  text: string,
  salary: number
): { valid: boolean; missingClauses: string[]; warnings: string[] } {
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

  if (salary < MIN_WAGE_JD) {
    warnings.push(
      `الراتب المدخل (${salary} د.أ) أقل من الحد الأدنى للأجور (${MIN_WAGE_JD} د.أ) المقرر قانوناً`
    );
  }

  return { valid: missingClauses.length === 0, missingClauses, warnings };
}

function buildPrompt(data: {
  employerName: string;
  employerRegistrationNumber?: string;
  employeeName: string;
  employeeId: string;
  jobTitle: string;
  department?: string;
  directManager?: string;
  monthlySalary: number;
  startDate: string;
  employmentType: string;
  probationPeriodDays: number;
  noticePeriod: string;
  annualLeaveDays: number;
  hasBonus: boolean;
  hasOvertime: boolean;
  benefits?: string[];
  hasConfidentialityClause: boolean;
  ipRights?: string;
  workLocation?: string;
  specialConditions?: string;
}): string {
  const probationText =
    data.probationPeriodDays === 0
      ? "لا تُطبَّق فترة تجربة على هذا العقد."
      : `فترة التجربة: ${data.probationPeriodDays} يوماً — وفقاً للمادة (35) من النص المرفق.`;

  const overtimeText = data.hasOvertime
    ? "ينطبق العمل الإضافي وفقاً للمادة (57) من النص المرفق."
    : "لا ينطبق نظام العمل الإضافي على هذه الوظيفة.";

  const bonusText = data.hasBonus
    ? "يحق للموظف الحصول على مكافأة أداء سنوية تُحدَّد بناءً على تقييم الأداء السنوي."
    : "لا تشمل هذه الوظيفة مكافأة أداء سنوية.";

  const benefitsList =
    data.benefits && data.benefits.length > 0
      ? `المزايا المتفق عليها: ${data.benefits.join("، ")}`
      : "لا توجد مزايا إضافية مُدرجة خارج الراتب الأساسي.";

  const confidentialityText = data.hasConfidentialityClause
    ? "يتضمن العقد بند السرية — يلتزم الموظف بالحفاظ على أسرار صاحب العمل الصناعية والتجارية وعدم إفشائها ولو بعد انقضاء العقد."
    : "لا يتضمن العقد بند سرية خاص.";

  const ipText = data.ipRights
    ? `حقوق الملكية الفكرية: ${data.ipRights}`
    : "حقوق الملكية الفكرية: وفق ما ينظمه القانون الأردني المعمول به.";

  const workLocationText = data.workLocation
    ? `مكان/نمط العمل: ${data.workLocation}`
    : "العمل حضوري في مقر صاحب العمل.";

  const specialText = data.specialConditions?.trim()
    ? `شروط خاصة إضافية: ${data.specialConditions}`
    : "لا توجد شروط خاصة إضافية.";

  const departmentText = data.department
    ? `القسم/الإدارة: ${data.department}`
    : "";

  const managerText = data.directManager
    ? `المشرف المباشر: ${data.directManager}`
    : "";

  const regNoText = data.employerRegistrationNumber
    ? `رقم التسجيل التجاري: ${data.employerRegistrationNumber}`
    : "";

  const salaryWarning =
    data.monthlySalary < MIN_WAGE_JD
      ? `تنبيه: الراتب المدخل (${data.monthlySalary} د.أ) أقل من الحد الأدنى القانوني (${MIN_WAGE_JD} د.أ). أدرج هذا التحذير بشكل واضح في بند الراتب.`
      : "";

  return `أنت كاتب عدل قانوني أردني متخصص. مهمتك الوحيدة صياغة عقد عمل رسمي استناداً إلى النص القانوني المرفق أدناه فقط.

══════════════════════════════════════════════════════
قواعد صارمة — يجب الالتزام بها حرفياً:
══════════════════════════════════════════════════════
1. لا تستخدم أي رموز تعبيرية (Emoji) في أي جزء من العقد — ممنوع منعاً باتاً.
2. كل معلومة قانونية في العقد يجب أن تكون مأخوذة حرفياً من "النص القانوني المرجعي" أدناه.
3. يُحظر تماماً اختراع أي مادة أو رقم مادة أو حكم أو نسبة أو مدة غير موجودة في النص المرفق.
4. لا تستخدم معلوماتك الخاصة أو ذاكرتك — فقط النص المرفق هو المصدر.
5. لكل بند اذكر رقم المادة بالضبط كما وردت في النص المرفق.
6. إذا كان موضوع ما غير مشمول في النص المرفق، اكتب بالحرف: [يُرجى مراجعة محامٍ أردني مرخص].
7. ابدأ مباشرةً بـ"عقد عمل" دون أي مقدمة أو تعليق.
8. لا تكتب أي جملة تبدأ بـ"وفقاً لعلمي" أو "عموماً" أو "في الغالب" — فقط ما ورد في النص.
══════════════════════════════════════════════════════

══════════════════════════════════════════════════════
النص القانوني المرجعي الوحيد:
══════════════════════════════════════════════════════
${JORDAN_LABOR_LAW_FULL}
══════════════════════════════════════════════════════

══════════════════════════════════════════════════════
بيانات العقد المطلوب صياغته:
══════════════════════════════════════════════════════
صاحب العمل: ${data.employerName}
${regNoText}
الموظف: ${data.employeeName}
رقم الهوية / جواز السفر: ${data.employeeId}
المسمى الوظيفي: ${data.jobTitle}
${departmentText}
${managerText}
الراتب الشهري: ${data.monthlySalary} دينار أردني
${salaryWarning}
تاريخ البدء: ${data.startDate}
نوع العقد: ${data.employmentType}
${probationText}
فترة الإشعار: ${data.noticePeriod} — وفقاً للمادة (21) من النص المرفق
الإجازة السنوية: ${data.annualLeaveDays} يوم عمل — وفقاً للمادة (61) من النص المرفق
${workLocationText}
مكافأة الأداء: ${bonusText}
العمل الإضافي: ${overtimeText}
المزايا: ${benefitsList}
بند السرية: ${confidentialityText}
حقوق الملكية الفكرية: ${ipText}
شروط خاصة: ${specialText}
══════════════════════════════════════════════════════

اكتب العقد الآن منظَّماً في الأجزاء التالية، مع الاستناد الصريح لرقم المادة القانونية في كل بند:

عقد عمل

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الأول: بيانات الطرفين
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

البند الأول: صاحب العمل
[اذكر اسم صاحب العمل ورقم التسجيل التجاري إن وُجد — وفق المادة (15) من النص المرفق]

البند الثاني: الموظف
[اذكر اسم الموظف ورقم هويته/جواز سفره والمسمى الوظيفي والقسم والمشرف المباشر إن وُجدا — وفق المادة (15) من النص المرفق]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الثاني: شروط العمل
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

البند الثالث: نوع العقد ومدته
[نوع العقد وتاريخ البدء وتاريخ الانتهاء إن كان محدد المدة — وفق المادة (15) من النص المرفق]

البند الرابع: فترة التجربة
[${probationText} — استند إلى المادة (35) من النص المرفق حصراً]

البند الخامس: فترة الإشعار
[${data.noticePeriod} — استند إلى المادة (21) من النص المرفق حصراً]

البند السادس: مكان وساعات العمل
[${workLocationText} — استند إلى المادة (56) من النص المرفق حصراً لساعات العمل]

البند السابع: العمل الإضافي
[${overtimeText} — استند إلى المادة (57) من النص المرفق حصراً مع النسب الواردة فيها]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الثالث: الراتب والمزايا
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

البند الثامن: الراتب الشهري
[${data.monthlySalary} د.أ — اذكر موعد الصرف خلال 7 أيام — استند إلى المادة (46) من النص المرفق${salaryWarning ? " — " + salaryWarning : ""}]

البند التاسع: مكافأة الأداء
[${bonusText}]

البند العاشر: المزايا والتأمينات
[${benefitsList} — استند إلى المادة (74) للضمان الاجتماعي و المادة (33) لصناديق الادخار من النص المرفق]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الرابع: الحقوق والالتزامات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

البند الحادي عشر: الإجازة السنوية
[${data.annualLeaveDays} يوم — استند إلى المادة (61) من النص المرفق حصراً]

البند الثاني عشر: الإجازة المرضية
[استند إلى المادة (65) من النص المرفق حصراً — اذكر المدد والشروط]

البند الثالث عشر: إجازة الأمومة
[استند إلى المادة (70) من النص المرفق حصراً]

البند الرابع عشر: السلامة والصحة المهنية
[استند إلى المواد (71-85) من النص المرفق حصراً]

البند الخامس عشر: السرية وحفظ أسرار العمل
[${confidentialityText}]

البند السادس عشر: حقوق الملكية الفكرية
[${ipText}]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الخامس: إنهاء العقد والشروط النهائية
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

البند السابع عشر: إنهاء العقد وبدل الإشعار
[استند إلى المادتين (21) و(25) من النص المرفق حصراً — اذكر الحقوق والتعويضات]

البند الثامن عشر: حالات الفصل الفوري المشروع
[استند إلى المادة (23) من النص المرفق حصراً — لا تزد على الحالات الواردة فيها]

البند التاسع عشر: مكافأة نهاية الخدمة
[استند إلى المادة (32) من النص المرفق حصراً]

البند العشرون: فض النزاعات
[استند إلى المادة (77) من النص المرفق حصراً]

البند الحادي والعشرون: الشروط الخاصة
[${specialText}]

البند الثاني والعشرون: أحكام عامة
هذا العقد مُحرَّر باللغة العربية وفق المادة (15) من قانون العمل الأردني رقم (8) لسنة 1996 وتعديلاته حتى القانون رقم (10) لسنة 2023. أي بند مخالف لأحكام القانون يُعدّ باطلاً، وتسري أحكام القانون بدلاً منه.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
المراجع القانونية المستند إليها في هذا العقد
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
قانون العمل الأردني رقم (8) لسنة 1996 وتعديلاته:
المادة (15): شكل عقد العمل وبيانات الهوية | المادة (21): الإشعار بإنهاء العقد | المادة (23): حالات الفصل الفوري | المادة (25): التعويض عن الفصل التعسفي | المادة (28): حق العامل في الاستقالة مع الحقوق | المادة (32): مكافأة نهاية الخدمة | المادة (33): صناديق الادخار والتقاعد | المادة (35): فترة التجربة | المادة (46): مواعيد صرف الأجور | المادة (56): ساعات العمل | المادة (57): العمل الإضافي | المادة (61): الإجازة السنوية | المادة (65): الإجازة المرضية | المادة (70): إجازة الأمومة | المادة (74): الضمان الاجتماعي | المادة (77): فض النزاعات

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
التوقيعات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
صاحب العمل: ___________________________    التاريخ: ________________
الموظف: ___________________________         التاريخ: ________________

─────────────────────────────────────────────────────
تنبيه: هذا العقد مُولَّد بمساعدة الذكاء الاصطناعي استناداً حصراً إلى قانون العمل الأردني رقم (8) لسنة 1996 وتعديلاته. يُنصح بمراجعة محامٍ أردني مرخص قبل التوقيع.`;
}

contractsRouter.post("/contracts/generate", async (req, res) => {
  const parsed = GenerateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }

  const { monthlySalary, probationPeriodDays } = parsed.data;

  if (probationPeriodDays > 90) {
    res.status(400).json({
      error: "فترة التجربة لا يجوز أن تتجاوز 90 يوماً وفقاً للمادة (35) من قانون العمل الأردني",
    });
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

    const validation = validateContract(contractText, monthlySalary);

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
    res.status(500).json({ error: "فشل في توليد العقد. يرجى المحاولة مرة أخرى." });
  }
});

export default contractsRouter;
