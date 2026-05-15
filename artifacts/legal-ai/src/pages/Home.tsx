import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGenerateContract } from "@workspace/api-client-react";
import {
  Copy, Check, FileText, Scale, FileDown,
  AlertTriangle, ChevronDown, ChevronUp, MessageCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RentalForm, ServiceForm, NdaForm, SupplierForm } from "@/components/ContractForms";

const MIN_WAGE = 290;

const BENEFITS_OPTIONS = [
  { id: "تأمين اجتماعي", label: "تأمين اجتماعي (إلزامي)" },
  { id: "تأمين صحي", label: "تأمين صحي" },
  { id: "بدل مواصلات", label: "بدل مواصلات" },
  { id: "بدل سكن", label: "بدل سكن" },
  { id: "بدل غلاء معيشة", label: "بدل غلاء معيشة" },
  { id: "صندوق ادخار", label: "صندوق ادخار" },
  { id: "صندوق تقاعد", label: "صندوق تقاعد" },
  { id: "تذاكر سفر للإجازة", label: "تذاكر سفر" },
];

const CONTRACT_TYPES = [
  { value: "employment", label: "عقد عمل" },
  { value: "rental",     label: "عقد إيجار" },
  { value: "service",    label: "عقد خدمات" },
  { value: "nda",        label: "اتفاقية سرية" },
  { value: "supplier",   label: "عقد مورد" },
] as const;

type ContractType = typeof CONTRACT_TYPES[number]["value"];

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  employment: "عقد عمل",
  rental:     "عقد إيجار",
  service:    "عقد خدمات",
  nda:        "اتفاقية سرية",
  supplier:   "عقد مورد",
};

const LOADING_MESSAGES: Record<ContractType, string> = {
  employment: "صياغة بنود عقد العمل...",
  rental:     "صياغة بنود عقد الإيجار...",
  service:    "صياغة بنود عقد الخدمات...",
  nda:        "صياغة اتفاقية عدم الإفصاح...",
  supplier:   "صياغة بنود عقد التوريد...",
};

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

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary shrink-0">
        {number}
      </div>
      <span className="text-xs font-bold text-primary/90 uppercase tracking-widest">{title}</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [contractType, setContractType] = useState<ContractType>("employment");
  const [nonEmploymentLoading, setNonEmploymentLoading] = useState(false);
  const [currentPartyName, setCurrentPartyName] = useState<string>("");
  const [wordLoading, setWordLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employerName: "", employerRegistrationNumber: "",
      employeeName: "", employeeId: "",
      jobTitle: "", department: "", directManager: "",
      monthlySalary: 0, startDate: "",
      employmentType: "", probationPeriodDays: 30,
      noticePeriod: "شهر واحد", annualLeaveDays: 14,
      hasBonus: false, hasOvertime: true,
      benefits: ["تأمين اجتماعي"],
      hasConfidentialityClause: true, ipRights: "",
      workLocation: "", specialConditions: "",
    },
  });

  const salary = form.watch("monthlySalary");
  const belowMinWage = salary > 0 && salary < MIN_WAGE;

  const { mutate, isPending: employmentLoading } = useGenerateContract({
    mutation: {
      onSuccess: (result) => {
        setGeneratedContract(result.contract);
        setValidationWarnings(result.validationWarnings ?? []);
        setCurrentPartyName(form.getValues().employeeName || "موظف");
        toast({
          title: "تم توليد العقد بنجاح",
          description:
            result.validationWarnings?.length
              ? `تم التوليد مع ملاحظات: ${result.validationWarnings.join("، ")}`
              : "يمكنك الآن مراجعة العقد ونسخه أو تحميله.",
        });
      },
      onError: (error: unknown) => {
        const err = error as { response?: { status?: number; data?: { missingClauses?: string[] } } };
        const is422 = err?.response?.status === 422;
        const missing = err?.response?.data?.missingClauses;
        toast({
          title: is422 ? "العقد غير مكتمل قانونياً" : "حدث خطأ",
          description:
            is422 && missing
              ? `البنود المفقودة: ${missing.join("، ")}`
              : "تعذر توليد العقد. الرجاء المحاولة مرة أخرى.",
          variant: "destructive",
        });
      },
    },
  });

  const isPending = employmentLoading || nonEmploymentLoading;

  function onSubmit(values: FormValues) {
    mutate({ data: values });
  }

  const handleCopy = () => {
    if (!generatedContract) return;
    navigator.clipboard.writeText(generatedContract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "تم النسخ", description: "تم نسخ العقد إلى الحافظة" });
  };

  const handleDownloadWord = async () => {
    if (!generatedContract) return;
    setWordLoading(true);
    const partyName = currentPartyName || "وثيقة";

    try {
      const res = await fetch("/api/contracts/export-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractText: generatedContract,
          contractTypeLabel: CONTRACT_TYPE_LABEL[contractType],
          partyName,
        }),
      });

      if (!res.ok) {
        toast({ title: "خطأ في التصدير", description: "تعذر تصدير الوثيقة", variant: "destructive" });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${CONTRACT_TYPE_LABEL[contractType]}-${partyName}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "تم التصدير", description: "تم تحميل الوثيقة بصيغة Word (.docx)" });
    } catch {
      toast({ title: "خطأ", description: "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setWordLoading(false);
    }
  };

  const handleReviewThis = () => {
    if (!generatedContract) return;
    sessionStorage.setItem("reviewContract", generatedContract);
    sessionStorage.setItem("reviewContractLabel", CONTRACT_TYPE_LABEL[contractType]);
    window.location.href = "/review";
  };

  const handleWhatsApp = () => {
    if (!generatedContract) return;
    navigator.clipboard.writeText(generatedContract).then(() => {
      window.open("https://wa.me/", "_blank");
      toast({
        title: "تم النسخ — افتح المحادثة والصق",
        description: "تم نسخ نص العقد. افتح المحادثة في واتساب والصق النص (Ctrl+V أو اضغط مطولاً)",
      });
    }).catch(() => {
      toast({
        title: "تعذر النسخ",
        description: "الرجاء نسخ العقد يدوياً ثم مشاركته عبر واتساب.",
        variant: "destructive",
      });
    });
  };

  const inputCls = "h-11 bg-background/50 focus:bg-background border-border/60 text-sm";
  const selectTriggerCls = "h-11 bg-background/50 focus:bg-background border-border/60 text-sm";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 md:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none -z-10" />

      <header className="w-full max-w-6xl mb-10 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-3.5 rounded-xl border border-primary/20 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
            <Scale className="w-9 h-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-0.5">قانوني AI</h1>
            <p className="text-primary/80 font-medium text-sm">منصة توليد العقود القانونية - الأردن</p>
          </div>
        </div>
        <a
          href="/review"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors border border-border/50 hover:border-primary/40 rounded-lg px-4 py-2"
        >
          <FileText className="w-4 h-4" />
          مراجع العقود
        </a>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        {/* ─── FORM PANEL ─── */}
        <div className="lg:col-span-5">
          <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-secondary/30 border-b border-border/50 pb-5">
              <CardTitle className="text-xl font-bold text-white">بيانات العقد</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                أدخل البيانات لتوليد عقد قانوني أردني في ثوانٍ.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              {/* Contract type selector */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-300 mb-2">نوع الوثيقة</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {CONTRACT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setContractType(t.value); setGeneratedContract(null); setValidationWarnings([]); setCurrentPartyName(""); setNonEmploymentLoading(false); }}
                      className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition-all text-center ${
                        contractType === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 bg-background/30 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ══ EMPLOYMENT FORM ══ */}
              {contractType === "employment" && (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <SectionHeader number="١" title="بيانات الطرفين" />

                    <FormField control={form.control} name="employerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300">اسم صاحب العمل <span className="text-red-400">*</span></FormLabel>
                        <FormControl><Input className={inputCls} placeholder="شركة الأفق للتجارة..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="employerRegistrationNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300">رقم التسجيل التجاري <span className="text-muted-foreground font-normal">(اختياري)</span></FormLabel>
                        <FormControl><Input className={inputCls} placeholder="12345678" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="border-t border-border/30" />

                    <FormField control={form.control} name="employeeName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300">اسم الموظف <span className="text-red-400">*</span></FormLabel>
                        <FormControl><Input className={inputCls} placeholder="أحمد محمد..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="employeeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300">رقم الهوية / جواز السفر <span className="text-red-400">*</span></FormLabel>
                        <FormControl><Input className={inputCls} placeholder="123456789" {...field} /></FormControl>
                        <p className="text-xs text-muted-foreground mt-1">مطلوب وفق المادة (15) من قانون العمل</p>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="jobTitle" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300">المسمى الوظيفي <span className="text-red-400">*</span></FormLabel>
                        <FormControl><Input className={inputCls} placeholder="مهندس برمجيات..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="department" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">القسم <span className="text-muted-foreground font-normal">(اختياري)</span></FormLabel>
                          <FormControl><Input className={inputCls} placeholder="هندسة البرمجيات..." {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="directManager" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">المشرف المباشر <span className="text-muted-foreground font-normal">(اختياري)</span></FormLabel>
                          <FormControl><Input className={inputCls} placeholder="اسم المشرف..." {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>

                    <div className="pt-1">
                      <SectionHeader number="٢" title="شروط العمل" />
                    </div>

                    <FormField control={form.control} name="employmentType" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300">نوع التعاقد <span className="text-red-400">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder="اختر نوع التعاقد..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="عقد دائم غير محدد المدة">عقد دائم (غير محدد المدة)</SelectItem>
                            <SelectItem value="عقد محدد المدة">عقد محدد المدة</SelectItem>
                            <SelectItem value="عقد جزئي">عقد جزئي (Part-time)</SelectItem>
                            <SelectItem value="عقد مؤقت">عقد مؤقت</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">تاريخ البدء <span className="text-red-400">*</span></FormLabel>
                          <FormControl><Input className={inputCls} type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="workLocation" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">مكان / نمط العمل</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder="حضوري..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="حضوري في مقر الشركة">حضوري</SelectItem>
                              <SelectItem value="عمل عن بعد بالكامل">عن بعد</SelectItem>
                              <SelectItem value="هجين (حضوري وعن بعد)">هجين</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="probationPeriodDays" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">فترة التجربة</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="0">بدون فترة تجربة</SelectItem>
                              <SelectItem value="30">30 يوم</SelectItem>
                              <SelectItem value="60">60 يوم</SelectItem>
                              <SelectItem value="90">90 يوم (الحد الأقصى — م.35)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="noticePeriod" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">فترة الإشعار <span className="text-red-400">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="أسبوع واحد">أسبوع واحد</SelectItem>
                              <SelectItem value="شهر واحد">شهر واحد (الحد الأدنى — م.21)</SelectItem>
                              <SelectItem value="شهرين">شهرين</SelectItem>
                              <SelectItem value="ثلاثة أشهر">ثلاثة أشهر</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="pt-1">
                      <SectionHeader number="٣" title="الراتب والمزايا" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="monthlySalary" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">الراتب الشهري (د.أ) <span className="text-red-400">*</span></FormLabel>
                          <FormControl><Input className={inputCls} type="number" placeholder="500" {...field} /></FormControl>
                          {belowMinWage && (
                            <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              أقل من الحد الأدنى ({MIN_WAGE} د.أ) — سيُدرج تحذير في العقد
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="annualLeaveDays" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-gray-300">الإجازة السنوية (أيام)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="14">14 يوم (الحد الأدنى)</SelectItem>
                              <SelectItem value="21">21 يوم</SelectItem>
                              <SelectItem value="25">25 يوم</SelectItem>
                              <SelectItem value="30">30 يوم</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="text-xs text-amber-400/80 -mt-3">
                      الحد الأدنى القانوني 14 يوم. بعد 5 سنوات خدمة يرتفع إلى 21 يوم (المادة 61)
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="hasBonus" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                          <div>
                            <FormLabel className="text-xs font-semibold text-gray-200">مكافأة الأداء</FormLabel>
                            <div className="text-xs text-muted-foreground mt-0.5">{field.value ? "مشمولة" : "غير مشمولة"}</div>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="hasOvertime" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                          <div>
                            <FormLabel className="text-xs font-semibold text-gray-200">عمل إضافي</FormLabel>
                            <div className="text-xs text-muted-foreground mt-0.5">{field.value ? "وفق م.57" : "غير مشمول"}</div>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="benefits" render={() => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300 mb-2 block">المزايا والتأمينات</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {BENEFITS_OPTIONS.map((option) => (
                            <FormField key={option.id} control={form.control} name="benefits"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center gap-2 rounded-md border border-border/50 bg-background/30 px-3 py-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(option.id)}
                                      onCheckedChange={(checked) => {
                                        const cur = field.value ?? [];
                                        field.onChange(checked ? [...cur, option.id] : cur.filter((v) => v !== option.id));
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-xs text-gray-300 font-normal cursor-pointer leading-tight">{option.label}</FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </FormItem>
                    )} />

                    <div className="pt-1">
                      <SectionHeader number="٤" title="الحقوق والالتزامات" />
                    </div>

                    <FormField control={form.control} name="hasConfidentialityClause" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3">
                        <div>
                          <FormLabel className="text-xs font-semibold text-gray-200">بند السرية</FormLabel>
                          <div className="text-xs text-muted-foreground mt-0.5">حفظ أسرار صاحب العمل التجارية</div>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="ipRights" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-300">حقوق الملكية الفكرية</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className={selectTriggerCls}><SelectValue placeholder="اختر..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="تؤول جميع حقوق الملكية الفكرية لصاحب العمل">لصاحب العمل</SelectItem>
                            <SelectItem value="تؤول جميع حقوق الملكية الفكرية للموظف">للموظف</SelectItem>
                            <SelectItem value="ملكية مشتركة بين الطرفين">مشترك</SelectItem>
                            <SelectItem value="وفق ما ينظمه القانون الأردني">وفق القانون</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <button type="button" onClick={() => setAdvancedOpen((v) => !v)}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-gray-300 transition-colors w-full">
                      {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      شروط خاصة إضافية
                    </button>

                    {advancedOpen && (
                      <FormField control={form.control} name="specialConditions" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea className="resize-none bg-background/50 focus:bg-background border-border/60 text-sm" placeholder="أي بنود أو شروط إضافية..." rows={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}

                    <div className="pt-2">
                      <Button type="submit" className="w-full h-13 text-base font-bold shadow-[0_4px_14px_rgba(212,175,55,0.2)] hover:shadow-[0_6px_20px_rgba(212,175,55,0.3)] transition-all py-3.5" disabled={isPending}>
                        {isPending ? <><Spinner className="ml-3 w-5 h-5 text-primary-foreground" /> جاري التوليد...</> : "توليد العقد"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {/* ══ NON-EMPLOYMENT FORMS ══ */}
              {contractType === "rental" && (
                <RentalForm
                  onResult={(c, name) => { setGeneratedContract(c); setCurrentPartyName(name); setValidationWarnings([]); toast({ title: "تم توليد عقد الإيجار" }); }}
                  onLoadingChange={setNonEmploymentLoading}
                />
              )}
              {contractType === "service" && (
                <ServiceForm
                  onResult={(c, name) => { setGeneratedContract(c); setCurrentPartyName(name); setValidationWarnings([]); toast({ title: "تم توليد عقد الخدمات" }); }}
                  onLoadingChange={setNonEmploymentLoading}
                />
              )}
              {contractType === "nda" && (
                <NdaForm
                  onResult={(c, name) => { setGeneratedContract(c); setCurrentPartyName(name); setValidationWarnings([]); toast({ title: "تم توليد اتفاقية السرية" }); }}
                  onLoadingChange={setNonEmploymentLoading}
                />
              )}
              {contractType === "supplier" && (
                <SupplierForm
                  onResult={(c, name) => { setGeneratedContract(c); setCurrentPartyName(name); setValidationWarnings([]); toast({ title: "تم توليد عقد التوريد" }); }}
                  onLoadingChange={setNonEmploymentLoading}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── CONTRACT PREVIEW ─── */}
        <div className="lg:col-span-7">
          <Card className="h-full border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden min-h-[600px] rounded-2xl relative">
            <CardHeader className="border-b border-border/50 bg-secondary/30 flex flex-row items-center justify-between py-4 shrink-0">
              <CardTitle className="flex items-center gap-2.5 text-lg font-bold text-white">
                <FileText className="w-5 h-5 text-primary" />
                {CONTRACT_TYPE_LABEL[contractType]}
              </CardTitle>
              {generatedContract && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-9 px-3 border-border/60 hover:bg-white/5 text-xs">
                    {copied ? <Check className="w-3.5 h-3.5 ml-1.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 ml-1.5 text-gray-300" />}
                    {copied ? "تم" : "نسخ"}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleDownloadWord} disabled={wordLoading} className="h-9 px-3 shadow-md text-xs">
                    {wordLoading
                      ? <><Spinner className="ml-1.5 w-3.5 h-3.5 text-primary-foreground" />جاري التصدير...</>
                      : <><FileDown className="w-3.5 h-3.5 ml-1.5" />تحميل Word</>
                    }
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleWhatsApp}
                    className="h-9 px-3 border-green-500/40 hover:bg-green-500/10 text-green-400 text-xs">
                    <MessageCircle className="w-3.5 h-3.5 ml-1.5" />
                    واتساب
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReviewThis}
                    className="h-9 px-3 border-purple-500/40 hover:bg-purple-500/10 text-purple-400 text-xs">
                    <Scale className="w-3.5 h-3.5 ml-1.5" />
                    مراجعة
                  </Button>
                </div>
              )}
            </CardHeader>

            {/* Validation warnings */}
            {validationWarnings.length > 0 && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-2.5">
                {validationWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Legal disclaimer banner */}
            {generatedContract && (
              <div className="bg-blue-500/8 border-b border-blue-500/20 px-5 py-2 flex items-start gap-2">
                <Scale className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                <p className="text-xs text-blue-300/80 leading-relaxed">
                  هذا العقد مُولَّد بالذكاء الاصطناعي استناداً للقانون الأردني. يُنصح بمراجعة محامٍ مرخص قبل التوقيع. المنصة لا تُمارس المهنة القانونية.
                </p>
              </div>
            )}

            <CardContent className="flex-1 p-0 relative bg-background/20 overflow-hidden">
              {isPending && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-md z-10 animate-in fade-in duration-500">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Scale className="w-7 h-7 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1.5">{LOADING_MESSAGES[contractType]}</h3>
                  <p className="text-primary/80 font-medium text-sm">يتم الآن تطبيق المواد القانونية الأردنية</p>
                </div>
              )}

              {generatedContract ? (
                <div className="p-8 md:p-10 h-full overflow-y-auto whitespace-pre-wrap leading-loose text-sm md:text-base font-serif text-gray-200">
                  {generatedContract}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center opacity-70">
                  <div className="bg-secondary/40 p-5 rounded-full mb-5 border border-border/50 shadow-inner">
                    <FileText className="w-14 h-14 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-300 mb-2">وثيقة العقد ستظهر هنا</h3>
                  <p className="text-sm mt-1.5 max-w-sm leading-relaxed">
                    أدخل البيانات في النموذج واضغط "توليد العقد" — سيُصاغ العقد استناداً حصراً إلى نصوص القانون الأردني.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
