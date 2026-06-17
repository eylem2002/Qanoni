import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { useToast } from "@/hooks/useToast";
import { submitContract } from "@/domains/contracts/contractsApi";
import { useContractStreamCallbacks } from "@/domains/contracts/useContractStream";
import { RHFTextField } from "@/components/form/RHFTextField";
import { Spinner } from "@/components/Spinner";

const ndaSchema = z.object({
  partyOneName: z.string().min(2, "مطلوب"),
  partyTwoName: z.string().min(2, "مطلوب"),
  purposeOfDisclosure: z.string().min(10, "مطلوب"),
  confidentialityDurationYears: z.coerce.number().default(2),
  scopeOfConfidential: z.string().min(10, "مطلوب"),
  permittedDisclosures: z.string().optional(),
  penaltyAmount: z.coerce.number().optional(),
  startDate: z.string().min(2, "مطلوب"),
});
type NdaValues = z.infer<typeof ndaSchema>;

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 } as const;

export function NdaForm() {
  const { toast } = useToast();
  const callbacks = useContractStreamCallbacks();
  const [loading, setLoading] = useState(false);
  const form = useForm<NdaValues>({
    resolver: zodResolver(ndaSchema),
    defaultValues: { confidentialityDurationYears: 2 },
  });

  async function onSubmit(values: NdaValues) {
    setLoading(true);
    await submitContract(
      "/api/contracts/generate-nda",
      values,
      callbacks,
      "تم توليد اتفاقية السرية",
      toast,
      values.partyOneName || "الطرف الأول",
    );
    setLoading(false);
  }

  return (
    <Box component="form" onSubmit={form.handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <RHFTextField control={form.control} name="partyOneName" label="الطرف الأول — المُفصِح" required placeholder="الجهة أو الشخص الذي يُفصح" />
      <RHFTextField control={form.control} name="partyTwoName" label="الطرف الثاني — المُستقبِل" required placeholder="الجهة أو الشخص الذي يستقبل" />
      <RHFTextField control={form.control} name="purposeOfDisclosure" label="الغرض من الإفصاح" required multiline rows={2} placeholder="دراسة شراكة تجارية..." />
      <RHFTextField control={form.control} name="scopeOfConfidential" label="نطاق المعلومات السرية" required multiline rows={2} placeholder="البيانات المالية، خطط العمل..." />
      <RHFTextField control={form.control} name="permittedDisclosures" label="الإفصاحات المسموحة (اختياري)" multiline rows={2} placeholder="الموظفون المعنيون مباشرة..." />

      <Box sx={twoCol}>
        <RHFTextField control={form.control} name="confidentialityDurationYears" label="مدة السرية (سنوات)" required type="number" placeholder="2" />
        <RHFTextField control={form.control} name="penaltyAmount" label="غرامة الإخلال (د.أ) — اختياري" type="number" placeholder="5000" />
      </Box>

      <RHFTextField control={form.control} name="startDate" label="تاريخ سريان الاتفاقية" required type="date" />

      <Box sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "hsl(224 45% 8% / 0.3)", px: 2, py: 1.25 }}>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          القانون الحاكم: القانون الأردني — المحاكم الأردنية المختصة
        </Typography>
      </Box>

      <Button type="submit" fullWidth disabled={loading} sx={{ height: 48 }}>
        {loading ? (<><Spinner size={16} /><Box component="span" sx={{ ml: 1 }}>جاري التوليد...</Box></>) : "توليد اتفاقية السرية"}
      </Button>
    </Box>
  );
}
