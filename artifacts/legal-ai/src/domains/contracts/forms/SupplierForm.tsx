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

const supplierSchema = z.object({
  buyerName: z.string().min(2, "مطلوب"),
  supplierName: z.string().min(2, "مطلوب"),
  goodsOrServices: z.string().min(10, "مطلوب"),
  totalContractValue: z.coerce.number().min(1, "مطلوب"),
  paymentTerms: z.string().min(1, "مطلوب"),
  deliverySchedule: z.string().min(2, "مطلوب"),
  deliveryLocation: z.string().min(2, "مطلوب"),
  warrantyPeriodDays: z.coerce.number().default(30),
  penaltyForDelay: z.coerce.number().optional(),
  hasExclusivity: z.boolean().default(false),
  specialConditions: z.string().optional(),
});
type SupplierValues = z.infer<typeof supplierSchema>;

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 } as const;

export function SupplierForm() {
  const { toast } = useToast();
  const callbacks = useContractStreamCallbacks();
  const [loading, setLoading] = useState(false);
  const form = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { warrantyPeriodDays: 30, hasExclusivity: false },
  });

  async function onSubmit(values: SupplierValues) {
    setLoading(true);
    await submitContract(
      "/api/contracts/generate-supplier",
      values,
      callbacks,
      "تم توليد عقد التوريد",
      toast,
      values.supplierName || "مورد",
    );
    setLoading(false);
  }

  return (
    <Box component="form" onSubmit={form.handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <RHFTextField control={form.control} name="buyerName" label="اسم المشتري / الجهة" required placeholder="شركة / مؤسسة..." />
      <RHFTextField control={form.control} name="supplierName" label="اسم المورد" required placeholder="..." />
      <RHFTextField control={form.control} name="goodsOrServices" label="وصف البضاعة / الخدمات" required multiline rows={3} placeholder="1000 كيلو قهوة نوع X..." />

      <Box sx={twoCol}>
        <RHFTextField control={form.control} name="totalContractValue" label="القيمة الإجمالية (د.أ)" required type="number" placeholder="10000" />
        <RHFTextField control={form.control} name="warrantyPeriodDays" label="فترة الضمان (أيام)" type="number" placeholder="30" />
      </Box>

      <RHFSelect
        control={form.control}
        name="paymentTerms"
        label="شروط الدفع"
        required
        options={[
          { value: "فور الاستلام والتحقق", label: "فور الاستلام" },
          { value: "خلال 30 يوماً من الاستلام", label: "خلال 30 يوم" },
          { value: "خلال 60 يوماً من الاستلام", label: "خلال 60 يوم" },
          { value: "خلال 90 يوماً من الاستلام", label: "خلال 90 يوم" },
        ]}
      />

      <RHFTextField control={form.control} name="deliverySchedule" label="جدول التوريد / مواعيد التسليم" required placeholder="دفعة شهرية / تسليم بتاريخ..." />
      <RHFTextField control={form.control} name="deliveryLocation" label="مكان التسليم" required placeholder="مستودع الشركة في عمان..." />

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, alignItems: "end" }}>
        <RHFTextField control={form.control} name="penaltyForDelay" label="غرامة التأخير (% يومياً)" type="number" slotProps={{ htmlInput: { step: "0.1" } }} placeholder="0.5" />
        <RHFSwitch control={form.control} name="hasExclusivity" label="عقد حصري" />
      </Box>

      <RHFTextField control={form.control} name="specialConditions" label="شروط خاصة (اختياري)" multiline rows={2} placeholder="..." />

      <Button type="submit" fullWidth disabled={loading} sx={{ height: 48 }}>
        {loading ? (<><Spinner size={16} /><Box component="span" sx={{ ml: 1 }}>جاري التوليد...</Box></>) : "توليد عقد التوريد"}
      </Button>
    </Box>
  );
}
