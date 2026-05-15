import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

const inputCls = "h-11 bg-background/50 focus:bg-background border-border/60 text-sm";
const selectCls = "h-11 bg-background/50 focus:bg-background border-border/60 text-sm";

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <FormLabel className="text-xs font-semibold text-gray-300">
      {label}{required && <span className="text-red-400 mr-0.5"> *</span>}
    </FormLabel>
  );
}

type FormCallbacks = {
  onResult: (contract: string) => void;
  onLoadingChange: (loading: boolean) => void;
};

async function submitContract(
  url: string,
  payload: unknown,
  callbacks: FormCallbacks,
  successTitle: string,
  toast: ReturnType<typeof useToast>["toast"],
): Promise<void> {
  callbacks.onLoadingChange(true);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: { contract?: string; error?: string; missingClauses?: string[] } = await res.json();
    if (!res.ok) {
      const is422 = res.status === 422;
      toast({
        title: is422 ? "العقد غير مكتمل" : "حدث خطأ",
        description:
          is422 && data.missingClauses?.length
            ? `البنود المفقودة: ${data.missingClauses.join("، ")}`
            : data.error ?? "تعذر توليد العقد. الرجاء المحاولة مرة أخرى.",
        variant: "destructive",
      });
      return;
    }
    callbacks.onResult(data.contract ?? "");
    toast({ title: successTitle, description: "يمكنك الآن مراجعة العقد ونسخه أو تحميله." });
  } catch {
    toast({
      title: "خطأ في الاتصال",
      description: "تعذر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت.",
      variant: "destructive",
    });
  } finally {
    callbacks.onLoadingChange(false);
  }
}

/* ─────────────────────────────────────────────────────────
   RENTAL FORM
───────────────────────────────────────────────────────── */
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

export function RentalForm({ onResult, onLoadingChange }: FormCallbacks) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const form = useForm<RentalValues>({
    resolver: zodResolver(rentalSchema),
    defaultValues: { contractDurationMonths: 12, depositAmount: 0, paymentDayOfMonth: 1 },
  });

  async function onSubmit(values: RentalValues) {
    setLoading(true);
    await submitContract("/api/contracts/generate-rental", values, { onResult, onLoadingChange }, "تم توليد عقد الإيجار", toast);
    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="landlordName" render={({ field }) => (
          <FormItem><FieldLabel label="اسم المؤجر" required /><FormControl><Input className={inputCls} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="tenantName" render={({ field }) => (
          <FormItem><FieldLabel label="اسم المستأجر" required /><FormControl><Input className={inputCls} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="propertyAddress" render={({ field }) => (
          <FormItem><FieldLabel label="عنوان العقار" required /><FormControl><Input className={inputCls} placeholder="عمان، الجبيهة، شارع..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="propertyType" render={({ field }) => (
            <FormItem>
              <FieldLabel label="نوع العقار" required />
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {["شقة","فيلا","محل تجاري","مستودع","مكتب"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="furnitureStatus" render={({ field }) => (
            <FormItem>
              <FieldLabel label="حالة التأثيث" required />
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {["مفروش","نصف مفروش","غير مفروش"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="monthlyRent" render={({ field }) => (
            <FormItem><FieldLabel label="الإيجار الشهري (د.أ)" required /><FormControl><Input className={inputCls} type="number" placeholder="250" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="depositAmount" render={({ field }) => (
            <FormItem><FieldLabel label="مبلغ التأمين (د.أ)" /><FormControl><Input className={inputCls} type="number" placeholder="500" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="contractDurationMonths" render={({ field }) => (
            <FormItem><FieldLabel label="مدة العقد (أشهر)" required /><FormControl><Input className={inputCls} type="number" placeholder="12" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem><FieldLabel label="تاريخ البدء" required /><FormControl><Input className={inputCls} type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="paymentDayOfMonth" render={({ field }) => (
          <FormItem><FieldLabel label="يوم استحقاق الإيجار شهرياً" /><FormControl><Input className={inputCls} type="number" min={1} max={28} placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="specialConditions" render={({ field }) => (
          <FormItem><FieldLabel label="شروط خاصة (اختياري)" /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={3} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
          {loading ? <><Spinner className="ml-2 w-4 h-4" />جاري التوليد...</> : "توليد عقد الإيجار"}
        </Button>
      </form>
    </Form>
  );
}

/* ─────────────────────────────────────────────────────────
   SERVICE FORM
───────────────────────────────────────────────────────── */
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

export function ServiceForm({ onResult, onLoadingChange }: FormCallbacks) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const form = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { hasRevisions: true, revisionCount: 2, hasConfidentialityClause: true },
  });
  const hasRevisions = form.watch("hasRevisions");

  async function onSubmit(values: ServiceValues) {
    setLoading(true);
    await submitContract("/api/contracts/generate-service", values, { onResult, onLoadingChange }, "تم توليد عقد الخدمات", toast);
    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="clientName" render={({ field }) => (
          <FormItem><FieldLabel label="اسم العميل" required /><FormControl><Input className={inputCls} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="providerName" render={({ field }) => (
          <FormItem><FieldLabel label="اسم مقدم الخدمة" required /><FormControl><Input className={inputCls} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="serviceDescription" render={({ field }) => (
          <FormItem><FieldLabel label="وصف الخدمة" required /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={3} placeholder="تصميم موقع..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="totalFee" render={({ field }) => (
            <FormItem><FieldLabel label="الأتعاب الإجمالية (د.أ)" required /><FormControl><Input className={inputCls} type="number" placeholder="500" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="deliveryDeadline" render={({ field }) => (
            <FormItem><FieldLabel label="الموعد النهائي للتسليم" required /><FormControl><Input className={inputCls} type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="paymentTerms" render={({ field }) => (
          <FormItem>
            <FieldLabel label="شروط الدفع" required />
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="دفعة واحدة عند الاستلام">دفعة واحدة عند الاستلام</SelectItem>
                <SelectItem value="50% مقدماً، 50% عند التسليم">50% مقدماً، 50% عند التسليم</SelectItem>
                <SelectItem value="دفعات شهرية متساوية">دفعات شهرية</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="ipOwnership" render={({ field }) => (
          <FormItem>
            <FieldLabel label="ملكية المخرجات" required />
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="للعميل بالكامل بعد سداد الأتعاب">للعميل</SelectItem>
                <SelectItem value="لمقدم الخدمة مع منح ترخيص للعميل">لمقدم الخدمة (مع ترخيص)</SelectItem>
                <SelectItem value="ملكية مشتركة بين الطرفين">مشترك</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="hasRevisions" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
              <FormLabel className="text-xs font-semibold text-gray-200">مراجعات</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
          {hasRevisions && (
            <FormField control={form.control} name="revisionCount" render={({ field }) => (
              <FormItem><FieldLabel label="عدد المراجعات" /><FormControl><Input className={inputCls} type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          )}
        </div>

        <FormField control={form.control} name="hasConfidentialityClause" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
            <FormLabel className="text-xs font-semibold text-gray-200">بند السرية</FormLabel>
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="specialConditions" render={({ field }) => (
          <FormItem><FieldLabel label="شروط خاصة (اختياري)" /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={2} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
          {loading ? <><Spinner className="ml-2 w-4 h-4" />جاري التوليد...</> : "توليد عقد الخدمات"}
        </Button>
      </form>
    </Form>
  );
}

/* ─────────────────────────────────────────────────────────
   NDA FORM
───────────────────────────────────────────────────────── */
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

export function NdaForm({ onResult, onLoadingChange }: FormCallbacks) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const form = useForm<NdaValues>({
    resolver: zodResolver(ndaSchema),
    defaultValues: { confidentialityDurationYears: 2 },
  });

  async function onSubmit(values: NdaValues) {
    setLoading(true);
    await submitContract("/api/contracts/generate-nda", values, { onResult, onLoadingChange }, "تم توليد اتفاقية السرية", toast);
    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="partyOneName" render={({ field }) => (
          <FormItem><FieldLabel label="الطرف الأول — المُفصِح" required /><FormControl><Input className={inputCls} placeholder="الجهة أو الشخص الذي يُفصح" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="partyTwoName" render={({ field }) => (
          <FormItem><FieldLabel label="الطرف الثاني — المُستقبِل" required /><FormControl><Input className={inputCls} placeholder="الجهة أو الشخص الذي يستقبل" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="purposeOfDisclosure" render={({ field }) => (
          <FormItem><FieldLabel label="الغرض من الإفصاح" required /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={2} placeholder="دراسة شراكة تجارية..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="scopeOfConfidential" render={({ field }) => (
          <FormItem><FieldLabel label="نطاق المعلومات السرية" required /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={2} placeholder="البيانات المالية، خطط العمل..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="permittedDisclosures" render={({ field }) => (
          <FormItem><FieldLabel label="الإفصاحات المسموحة (اختياري)" /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={2} placeholder="الموظفون المعنيون مباشرة..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="confidentialityDurationYears" render={({ field }) => (
            <FormItem><FieldLabel label="مدة السرية (سنوات)" required /><FormControl><Input className={inputCls} type="number" min={1} placeholder="2" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="penaltyAmount" render={({ field }) => (
            <FormItem><FieldLabel label="غرامة الإخلال (د.أ) — اختياري" /><FormControl><Input className={inputCls} type="number" placeholder="5000" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="startDate" render={({ field }) => (
          <FormItem><FieldLabel label="تاريخ سريان الاتفاقية" required /><FormControl><Input className={inputCls} type="date" {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="rounded-lg border border-border/40 bg-background/30 px-4 py-2.5 text-xs text-muted-foreground">
          القانون الحاكم: القانون الأردني — المحاكم الأردنية المختصة
        </div>

        <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
          {loading ? <><Spinner className="ml-2 w-4 h-4" />جاري التوليد...</> : "توليد اتفاقية السرية"}
        </Button>
      </form>
    </Form>
  );
}

/* ─────────────────────────────────────────────────────────
   SUPPLIER FORM
───────────────────────────────────────────────────────── */
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

export function SupplierForm({ onResult, onLoadingChange }: FormCallbacks) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const form = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { warrantyPeriodDays: 30, hasExclusivity: false },
  });

  async function onSubmit(values: SupplierValues) {
    setLoading(true);
    await submitContract("/api/contracts/generate-supplier", values, { onResult, onLoadingChange }, "تم توليد عقد التوريد", toast);
    setLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="buyerName" render={({ field }) => (
          <FormItem><FieldLabel label="اسم المشتري / الجهة" required /><FormControl><Input className={inputCls} placeholder="شركة / مؤسسة..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="supplierName" render={({ field }) => (
          <FormItem><FieldLabel label="اسم المورد" required /><FormControl><Input className={inputCls} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="goodsOrServices" render={({ field }) => (
          <FormItem><FieldLabel label="وصف البضاعة / الخدمات" required /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={3} placeholder="1000 كيلو قهوة نوع X..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="totalContractValue" render={({ field }) => (
            <FormItem><FieldLabel label="القيمة الإجمالية (د.أ)" required /><FormControl><Input className={inputCls} type="number" placeholder="10000" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="warrantyPeriodDays" render={({ field }) => (
            <FormItem><FieldLabel label="فترة الضمان (أيام)" /><FormControl><Input className={inputCls} type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="paymentTerms" render={({ field }) => (
          <FormItem>
            <FieldLabel label="شروط الدفع" required />
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger className={selectCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="فور الاستلام والتحقق">فور الاستلام</SelectItem>
                <SelectItem value="خلال 30 يوماً من الاستلام">خلال 30 يوم</SelectItem>
                <SelectItem value="خلال 60 يوماً من الاستلام">خلال 60 يوم</SelectItem>
                <SelectItem value="خلال 90 يوماً من الاستلام">خلال 90 يوم</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="deliverySchedule" render={({ field }) => (
          <FormItem><FieldLabel label="جدول التوريد / مواعيد التسليم" required /><FormControl><Input className={inputCls} placeholder="دفعة شهرية / تسليم بتاريخ..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="deliveryLocation" render={({ field }) => (
          <FormItem><FieldLabel label="مكان التسليم" required /><FormControl><Input className={inputCls} placeholder="مستودع الشركة في عمان..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="penaltyForDelay" render={({ field }) => (
            <FormItem><FieldLabel label="غرامة التأخير (% يومياً)" /><FormControl><Input className={inputCls} type="number" step="0.1" placeholder="0.5" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="hasExclusivity" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3 mt-5">
              <FormLabel className="text-xs font-semibold text-gray-200">عقد حصري</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="specialConditions" render={({ field }) => (
          <FormItem><FieldLabel label="شروط خاصة (اختياري)" /><FormControl><Textarea className="resize-none bg-background/50 border-border/60 text-sm" rows={2} placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
          {loading ? <><Spinner className="ml-2 w-4 h-4" />جاري التوليد...</> : "توليد عقد التوريد"}
        </Button>
      </form>
    </Form>
  );
}
