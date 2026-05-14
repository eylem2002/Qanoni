import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { GenerateContractBody } from "@workspace/api-zod";

const contractsRouter = Router();

contractsRouter.post("/contracts/generate", async (req, res) => {
  const parsed = GenerateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const {
    employerName,
    employeeName,
    jobTitle,
    monthlySalary,
    startDate,
    employmentType,
  } = parsed.data;

  const prompt = `أنت متخصص قانوني أردني خبير في صياغة عقود العمل.

اكتب عقد عمل احترافي بالعربية يتوافق 100% مع القانون الأردني رقم 8 لسنة 1996.

البيانات:
- صاحب العمل: ${employerName}
- الموظف: ${employeeName}
- المسمى الوظيفي: ${jobTitle}
- الراتب الشهري: ${monthlySalary} دينار أردني
- تاريخ البدء: ${startDate}
- نوع التعاقد: ${employmentType}

اكتب العقد كاملاً بصيغة رسمية قانونية احترافية.

تأكد من تضمين:
1. اسم الأطراف والمعلومات الأساسية
2. تفاصيل الراتب والمزايا
3. ساعات العمل (8 ساعات يومياً)
4. الإجازات السنوية (14 يوم حسب القانون الأردني)
5. الإجازات المرضية (حسب القانون)
6. بنود الإنهاء والفصل
7. التزامات الطرفين
8. التوقيعات والتاريخ

ابدأ مباشرة بالعقد بدون مقدمات.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const contractText = block.type === "text" ? block.text : "";

    res.json({ contract: contractText });
  } catch (err) {
    req.log.error({ err }, "Contract generation failed");
    res.status(500).json({ error: "فشل في توليد العقد. يرجى المحاولة مرة أخرى." });
  }
});

export default contractsRouter;
