import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";

import { useToast } from "@/hooks/useToast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { toggleAdvanced } from "@/app/store/slices/uiSlice";
import { submitContract } from "@/domains/contracts/contractsApi";
import { useContractStreamCallbacks } from "@/domains/contracts/useContractStream";
import { BENEFITS_OPTIONS, MIN_WAGE } from "@/domains/contracts/constants";
import { SectionHeader } from "@/components/SectionHeader";
import { FieldLabel } from "@/components/form/FieldLabel";
import { RHFTextField } from "@/components/form/RHFTextField";
import { RHFSelect } from "@/components/form/RHFSelect";
import { RHFSwitch } from "@/components/form/RHFSwitch";
import { Spinner } from "@/components/Spinner";

const formSchema = z.object({
  employerName: z.string().min(2, "الرجاء إدخال اسم صاحب العمل"),
  employerRegistrationNumber: z.string().optional(),
  employeeName: z.string().min(2, "الرجاء إدخال اسم الموظف"),
  employeeId: z.string().min(6, "رقم الهوية 6 أحرف على الأقل").max(20),
  jobTitle: z.string().min(2, "الرجاء إدخال المسمى الوظيفي"),
  department: z.string().optional(),
  directManager: z.string().optional(),
  monthlySalary: z.coerce.number().min(1, "الرجاء إدخال راتب صحيح"),
  startDate: z.string().min(2, "الرجاء إدخال تاريخ البدء"),
  employmentType: z.string().min(2, "الرجاء اختيار نوع التعاقد"),
  probationPeriodDays: z.coerce.number(),
  noticePeriod: z.string().min(1, "الرجاء اختيار فترة الإشعار"),
  annualLeaveDays: z.coerce.number(),
  hasBonus: z.boolean(),
  hasOvertime: z.boolean(),
  benefits: z.array(z.string()),
  hasConfidentialityClause: z.boolean(),
  ipRights: z.string().optional(),
  workLocation: z.string().optional(),
  specialConditions: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 } as const;

export function EmploymentForm() {
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const advancedOpen = useAppSelector((s) => s.ui.advancedOpen);
  const callbacks = useContractStreamCallbacks();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employerName: "",
      employerRegistrationNumber: "",
      employeeName: "",
      employeeId: "",
      jobTitle: "",
      department: "",
      directManager: "",
      monthlySalary: 0,
      startDate: "",
      employmentType: "",
      probationPeriodDays: 30,
      noticePeriod: "شهر واحد",
      annualLeaveDays: 14,
      hasBonus: false,
      hasOvertime: true,
      benefits: ["تأمين اجتماعي"],
      hasConfidentialityClause: true,
      ipRights: "",
      workLocation: "",
      specialConditions: "",
    },
  });

  const salary = form.watch("monthlySalary");
  const belowMinWage = salary > 0 && salary < MIN_WAGE;

  async function onSubmit(values: FormValues) {
    setLoading(true);
    await submitContract(
      "/api/contracts/generate",
      values,
      callbacks,
      "تم توليد العقد بنجاح",
      toast,
      values.employeeName || "موظف",
    );
    setLoading(false);
  }

  return (
    <Box
      component="form"
      onSubmit={form.handleSubmit(onSubmit)}
      sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
    >
      <SectionHeader number="١" title="بيانات الطرفين" />

      <RHFTextField
        control={form.control}
        name="employerName"
        label="اسم صاحب العمل"
        required
        placeholder="شركة الأفق للتجارة..."
      />
      <RHFTextField
        control={form.control}
        name="employerRegistrationNumber"
        label="رقم التسجيل التجاري"
        hint="(اختياري)"
        placeholder="12345678"
      />

      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />

      <RHFTextField
        control={form.control}
        name="employeeName"
        label="اسم الموظف"
        required
        placeholder="أحمد محمد..."
      />
      <RHFTextField
        control={form.control}
        name="employeeId"
        label="رقم الهوية / جواز السفر"
        required
        placeholder="123456789"
        helpText="مطلوب وفق المادة (15) من قانون العمل"
      />
      <RHFTextField
        control={form.control}
        name="jobTitle"
        label="المسمى الوظيفي"
        required
        placeholder="مهندس برمجيات..."
      />

      <Box sx={twoCol}>
        <RHFTextField
          control={form.control}
          name="department"
          label="القسم"
          hint="(اختياري)"
          placeholder="هندسة البرمجيات..."
        />
        <RHFTextField
          control={form.control}
          name="directManager"
          label="المشرف المباشر"
          hint="(اختياري)"
          placeholder="اسم المشرف..."
        />
      </Box>

      <SectionHeader number="٢" title="شروط العمل" />

      <RHFSelect
        control={form.control}
        name="employmentType"
        label="نوع التعاقد"
        required
        placeholder="اختر نوع التعاقد..."
        options={[
          { value: "عقد دائم غير محدد المدة", label: "عقد دائم (غير محدد المدة)" },
          { value: "عقد محدد المدة", label: "عقد محدد المدة" },
          { value: "عقد جزئي", label: "عقد جزئي (Part-time)" },
          { value: "عقد مؤقت", label: "عقد مؤقت" },
        ]}
      />

      <Box sx={twoCol}>
        <RHFTextField
          control={form.control}
          name="startDate"
          label="تاريخ البدء"
          required
          type="date"
        />
        <RHFSelect
          control={form.control}
          name="workLocation"
          label="مكان / نمط العمل"
          placeholder="حضوري..."
          options={[
            { value: "حضوري في مقر الشركة", label: "حضوري" },
            { value: "عمل عن بعد بالكامل", label: "عن بعد" },
            { value: "هجين (حضوري وعن بعد)", label: "هجين" },
          ]}
        />
      </Box>

      <Box sx={twoCol}>
        <RHFSelect
          control={form.control}
          name="probationPeriodDays"
          label="فترة التجربة"
          options={[
            { value: "0", label: "بدون فترة تجربة" },
            { value: "30", label: "30 يوم" },
            { value: "60", label: "60 يوم" },
            { value: "90", label: "90 يوم (الحد الأقصى — م.35)" },
          ]}
        />
        <RHFSelect
          control={form.control}
          name="noticePeriod"
          label="فترة الإشعار"
          required
          options={[
            { value: "أسبوع واحد", label: "أسبوع واحد" },
            { value: "شهر واحد", label: "شهر واحد (الحد الأدنى — م.21)" },
            { value: "شهرين", label: "شهرين" },
            { value: "ثلاثة أشهر", label: "ثلاثة أشهر" },
          ]}
        />
      </Box>

      <SectionHeader number="٣" title="الراتب والمزايا" />

      <Box sx={twoCol}>
        <Box>
          <RHFTextField
            control={form.control}
            name="monthlySalary"
            label="الراتب الشهري (د.أ)"
            required
            type="number"
            placeholder="500"
          />
          {belowMinWage && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: 12, color: "error.main", mt: 0.5 }}>
              <AlertTriangle className="w-3 h-3" style={{ flexShrink: 0 }} />
              أقل من الحد الأدنى ({MIN_WAGE} د.أ) — سيُدرج تحذير في العقد
            </Box>
          )}
        </Box>
        <RHFSelect
          control={form.control}
          name="annualLeaveDays"
          label="الإجازة السنوية (أيام)"
          options={[
            { value: "14", label: "14 يوم (الحد الأدنى)" },
            { value: "21", label: "21 يوم" },
            { value: "25", label: "25 يوم" },
            { value: "30", label: "30 يوم" },
          ]}
        />
      </Box>
      <Typography sx={{ fontSize: 12, color: "hsl(43 96% 56% / 0.8)", mt: -1.5 }}>
        الحد الأدنى القانوني 14 يوم. بعد 5 سنوات خدمة يرتفع إلى 21 يوم (المادة 61)
      </Typography>

      <Box sx={twoCol}>
        <RHFSwitch
          control={form.control}
          name="hasBonus"
          label="مكافأة الأداء"
          description={(checked) => (checked ? "مشمولة" : "غير مشمولة")}
        />
        <RHFSwitch
          control={form.control}
          name="hasOvertime"
          label="عمل إضافي"
          description={(checked) => (checked ? "وفق م.57" : "غير مشمول")}
        />
      </Box>

      <Controller
        control={form.control}
        name="benefits"
        render={({ field }) => (
          <Box>
            <FieldLabel label="المزايا والتأمينات" />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              {BENEFITS_OPTIONS.map((option) => {
                const checked = field.value?.includes(option.id) ?? false;
                return (
                  <Box
                    key={option.id}
                    component="label"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "hsl(224 45% 8% / 0.3)",
                      px: 1.5,
                      py: 0.75,
                      cursor: "pointer",
                    }}
                  >
                    <Checkbox
                      size="small"
                      sx={{ p: 0 }}
                      checked={checked}
                      onChange={(e) => {
                        const cur = field.value ?? [];
                        field.onChange(
                          e.target.checked ? [...cur, option.id] : cur.filter((v) => v !== option.id),
                        );
                      }}
                    />
                    <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.2 }}>
                      {option.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      />

      <SectionHeader number="٤" title="الحقوق والالتزامات" />

      <RHFSwitch
        control={form.control}
        name="hasConfidentialityClause"
        label="بند السرية"
        description="حفظ أسرار صاحب العمل التجارية"
      />

      <RHFSelect
        control={form.control}
        name="ipRights"
        label="حقوق الملكية الفكرية"
        options={[
          { value: "تؤول جميع حقوق الملكية الفكرية لصاحب العمل", label: "لصاحب العمل" },
          { value: "تؤول جميع حقوق الملكية الفكرية للموظف", label: "للموظف" },
          { value: "ملكية مشتركة بين الطرفين", label: "مشترك" },
          { value: "وفق ما ينظمه القانون الأردني", label: "وفق القانون" },
        ]}
      />

      <Box
        component="button"
        type="button"
        onClick={() => dispatch(toggleAdvanced())}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontSize: 12,
          color: "text.secondary",
          background: "none",
          border: "none",
          cursor: "pointer",
          width: "100%",
          p: 0,
          font: "inherit",
          "&:hover": { color: "rgba(255,255,255,0.85)" },
        }}
      >
        {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        شروط خاصة إضافية
      </Box>

      {advancedOpen && (
        <RHFTextField
          control={form.control}
          name="specialConditions"
          multiline
          rows={3}
          placeholder="أي بنود أو شروط إضافية..."
        />
      )}

      <Button type="submit" fullWidth disabled={loading} sx={{ height: 52, fontSize: 16, mt: 1 }}>
        {loading ? (
          <>
            <Spinner size={20} />
            <Box component="span" sx={{ ml: 1.5 }}>جاري التوليد...</Box>
          </>
        ) : (
          "توليد العقد"
        )}
      </Button>
    </Box>
  );
}
