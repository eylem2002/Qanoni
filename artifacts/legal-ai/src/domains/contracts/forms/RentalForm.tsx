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
import { Spinner } from "@/components/Spinner";

const rentalSchema = z.object({
  landlordName: z.string().min(2, "مطلوب"),
  tenantName: z.string().min(2, "مطلوب"),
  propertyAddress: z.string().min(4, "مطلوب"),
  propertyType: z.string().min(1, "مطلوب"),
  monthlyRent: z.coerce.number().min(1, "مطلوب"),
  contractDurationMonths: z.coerce.number().default(12),
  startDate: z.string().min(2, "مطلوب"),
  depositAmount: z.coerce.number().default(0),
  paymentDayOfMonth: z.coerce.number().default(1),
  furnitureStatus: z.string().min(1, "مطلوب"),
  specialConditions: z.string().optional(),
});
type RentalValues = z.infer<typeof rentalSchema>;

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 } as const;
const toOptions = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));

export function RentalForm() {
  const { toast } = useToast();
  const callbacks = useContractStreamCallbacks();
  const [loading, setLoading] = useState(false);
  const form = useForm<RentalValues>({
    resolver: zodResolver(rentalSchema),
    defaultValues: { contractDurationMonths: 12, depositAmount: 0, paymentDayOfMonth: 1 },
  });

  async function onSubmit(values: RentalValues) {
    setLoading(true);
    await submitContract(
      "/api/contracts/generate-rental",
      values,
      callbacks,
      "تم توليد عقد الإيجار",
      toast,
      values.tenantName || "مستأجر",
    );
    setLoading(false);
  }

  return (
    <Box component="form" onSubmit={form.handleSubmit(onSubmit)} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <RHFTextField control={form.control} name="landlordName" label="اسم المؤجر" required placeholder="..." />
      <RHFTextField control={form.control} name="tenantName" label="اسم المستأجر" required placeholder="..." />
      <RHFTextField control={form.control} name="propertyAddress" label="عنوان العقار" required placeholder="عمان، الجبيهة، شارع..." />

      <Box sx={twoCol}>
        <RHFSelect control={form.control} name="propertyType" label="نوع العقار" required options={toOptions(["شقة", "فيلا", "محل تجاري", "مستودع", "مكتب"])} />
        <RHFSelect control={form.control} name="furnitureStatus" label="حالة التأثيث" required options={toOptions(["مفروش", "نصف مفروش", "غير مفروش"])} />
      </Box>

      <Box sx={twoCol}>
        <RHFTextField control={form.control} name="monthlyRent" label="الإيجار الشهري (د.أ)" required type="number" placeholder="250" />
        <RHFTextField control={form.control} name="depositAmount" label="مبلغ التأمين (د.أ)" type="number" placeholder="500" />
      </Box>

      <Box sx={twoCol}>
        <RHFTextField control={form.control} name="contractDurationMonths" label="مدة العقد (أشهر)" required type="number" placeholder="12" />
        <RHFTextField control={form.control} name="startDate" label="تاريخ البدء" required type="date" />
      </Box>

      <RHFTextField control={form.control} name="paymentDayOfMonth" label="يوم استحقاق الإيجار شهرياً" type="number" placeholder="1" />
      <RHFTextField control={form.control} name="specialConditions" label="شروط خاصة (اختياري)" multiline rows={3} placeholder="..." />

      <Button type="submit" fullWidth disabled={loading} sx={{ height: 48 }}>
        {loading ? (<><Spinner size={16} /><Box component="span" sx={{ ml: 1 }}>جاري التوليد...</Box></>) : "توليد عقد الإيجار"}
      </Button>
    </Box>
  );
}
