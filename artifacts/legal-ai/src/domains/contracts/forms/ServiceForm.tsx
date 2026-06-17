import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

import { useToast } from "@/hooks/useToast";
import { submitContract } from "@/domains/contracts/contractsApi";
import { useContractStreamCallbacks } from "@/domains/contracts/useContractStream";
import { RHFTextField } from "@/components/form/RHFTextField";
import { RHFSelect } from "@/components/form/RHFSelect";
import { RHFSwitch } from "@/components/form/RHFSwitch";
import { Spinner } from "@/components/Spinner";

const serviceSchema = z.object({
  clientName: z.string().min(2, "مطلوب"),
  providerName: z.string().min(2, "مطلوب"),
  serviceDescription: z.string().min(10, "مطلوب"),
  totalFee: z.coerce.number().min(1, "مطلوب"),
  paymentTerms: z.string().min(1, "مطلوب"),
  deliveryDeadline: z.string().min(2, "مطلوب"),
  hasRevisions: z.boolean().default(true),
  revisionCount: z.coerce.number().default(2),
  ipOwnership: z.string().min(1, "مطلوب"),
  hasConfidentialityClause: z.boolean().default(true),
  specialConditions: z.string().optional(),
});
type ServiceValues = z.infer<typeof serviceSchema>;

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 } as const;

export function ServiceForm() {
  const { toast } = useToast();
  const callbacks = useContractStreamCallbacks();
  const [loading, setLoading] = useState(false);
  const form = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { hasRevisions: true, revisionCount: 2, hasConfidentialityClause: true },
  });
  const hasRevisions = form.watch("hasRevisions");

  async function onSubmit(values: ServiceValues) {
    setLoading(true);
    await submitContract(
      "/api/contracts/generate-service",
      values,
      callbacks,
      "تم توليد عقد الخدمات",
      toast,
      values.clientName || "عميل",
    );
    setLoading(false);
  }

  return (
    <Box component="form" onSubmit={form.handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <RHFTextField control={form.control} name="clientName" label="اسم العميل" required placeholder="..." />
      <RHFTextField control={form.control} name="providerName" label="اسم مقدم الخدمة" required placeholder="..." />
      <RHFTextField control={form.control} name="serviceDescription" label="وصف الخدمة" required multiline rows={3} placeholder="تصميم موقع..." />

      <Box sx={twoCol}>
        <RHFTextField control={form.control} name="totalFee" label="الأتعاب الإجمالية (د.أ)" required type="number" placeholder="500" />
        <RHFTextField control={form.control} name="deliveryDeadline" label="الموعد النهائي للتسليم" required type="date" />
      </Box>

      <RHFSelect
        control={form.control}
        name="paymentTerms"
        label="شروط الدفع"
        required
        options={[
          { value: "دفعة واحدة عند الاستلام", label: "دفعة واحدة عند الاستلام" },
          { value: "50% مقدماً، 50% عند التسليم", label: "50% مقدماً، 50% عند التسليم" },
          { value: "دفعات شهرية متساوية", label: "دفعات شهرية" },
        ]}
      />

      <RHFSelect
        control={form.control}
        name="ipOwnership"
        label="ملكية المخرجات"
        required
        options={[
          { value: "للعميل بالكامل بعد سداد الأتعاب", label: "للعميل" },
          { value: "لمقدم الخدمة مع منح ترخيص للعميل", label: "لمقدم الخدمة (مع ترخيص)" },
          { value: "ملكية مشتركة بين الطرفين", label: "مشترك" },
        ]}
      />

      <Box sx={twoCol}>
        <RHFSwitch control={form.control} name="hasRevisions" label="مراجعات" />
        {hasRevisions && (
          <RHFTextField control={form.control} name="revisionCount" label="عدد المراجعات" type="number" />
        )}
      </Box>

      <RHFSwitch control={form.control} name="hasConfidentialityClause" label="بند السرية" />
      <RHFTextField control={form.control} name="specialConditions" label="شروط خاصة (اختياري)" multiline rows={2} placeholder="..." />

      <Button type="submit" fullWidth disabled={loading} sx={{ height: 48 }}>
        {loading ? (<><Spinner size={16} /><Box component="span" sx={{ ml: 1 }}>جاري التوليد...</Box></>) : "توليد عقد الخدمات"}
      </Button>
    </Box>
  );
}
