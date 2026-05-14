import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGenerateContract } from "@workspace/api-client-react";
import { Copy, Check, FileText, Scale, FileDown } from "lucide-react";
import jsPDF from "jspdf";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  employerName: z.string().min(2, "الرجاء إدخال اسم صاحب العمل"),
  employeeName: z.string().min(2, "الرجاء إدخال اسم الموظف"),
  jobTitle: z.string().min(2, "الرجاء إدخال المسمى الوظيفي"),
  monthlySalary: z.coerce.number().min(1, "الرجاء إدخال راتب صحيح"),
  startDate: z.string().min(2, "الرجاء إدخال تاريخ البدء"),
  employmentType: z.string().min(2, "الرجاء اختيار نوع التعاقد"),
  probationPeriodDays: z.coerce.number(),
  annualLeaveDays: z.coerce.number(),
  hasBonus: z.boolean(),
  hasOvertime: z.boolean(),
  specialConditions: z.string().optional(),
});

export default function Home() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employerName: "",
      employeeName: "",
      jobTitle: "",
      monthlySalary: 0,
      startDate: "",
      employmentType: "",
      probationPeriodDays: 90,
      annualLeaveDays: 14,
      hasBonus: false,
      hasOvertime: true,
      specialConditions: "",
    },
  });

  const { mutate, isPending } = useGenerateContract({
    mutation: {
      onSuccess: (result) => {
        setGeneratedContract(result.contract);
        toast({
          title: "تم توليد العقد بنجاح",
          description: result.validationWarnings && result.validationWarnings.length > 0 
            ? `تم التوليد مع ملاحظات: ${result.validationWarnings.join("، ")}`
            : "يمكنك الآن مراجعة العقد ونسخه أو تحميله.",
        });
      },
      onError: (error) => {
        toast({
          title: "حدث خطأ",
          description: "تعذر توليد العقد. الرجاء المحاولة مرة أخرى.",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutate({ data: values });
  }

  const handleCopy = () => {
    if (generatedContract) {
      navigator.clipboard.writeText(generatedContract);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "تم النسخ",
        description: "تم نسخ العقد إلى الحافظة"
      });
    }
  };

  const handleDownloadPdf = () => {
    if (!generatedContract) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    
    // Use a Unicode-compatible font — jsPDF default doesn't support Arabic well,
    // so render the contract as a structured text block with RTL awareness.
    // Since jsPDF has limited Arabic support, write the text split by lines
    // and use the default font, noting that for proper Arabic rendering a 
    // production app would use a server-side PDF generator.
    // For now, use the standard approach:
    
    doc.setFont("helvetica");
    doc.setFontSize(12);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    
    const lines = doc.splitTextToSize(generatedContract, maxWidth);
    
    let y = 20;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.getHeight();
    
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, pageWidth - margin, y, { align: "right" });
      y += lineHeight;
    }
    
    doc.save(`عقد_عمل_${form.getValues().employeeName || "موظف"}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none -z-10"></div>
      
      <header className="w-full max-w-6xl mb-12 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-4 rounded-xl border border-primary/20 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
            <Scale className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-1">
              ⚖️ قانوني AI
            </h1>
            <p className="text-primary/80 font-medium text-sm md:text-base">
              منصة توليد العقود القانونية - الأردن
            </p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        <div className="lg:col-span-5">
          <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
            <CardHeader className="bg-secondary/30 border-b border-border/50 pb-6">
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                بيانات العقد
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground mt-2">
                أدخل بيانات الطرفين لتوليد عقد عمل متوافق مع قانون العمل الأردني رقم 8 لسنة 1996.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="employerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-200">اسم صاحب العمل</FormLabel>
                        <FormControl>
                          <Input className="h-12 bg-background/50 focus:bg-background border-border/60" placeholder="شركة الأفق للتجارة..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employeeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-200">اسم الموظف</FormLabel>
                        <FormControl>
                          <Input className="h-12 bg-background/50 focus:bg-background border-border/60" placeholder="أحمد محمد..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-200">المسمى الوظيفي</FormLabel>
                        <FormControl>
                          <Input className="h-12 bg-background/50 focus:bg-background border-border/60" placeholder="مهندس برمجيات..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="monthlySalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-200">الراتب الشهري (د.أ)</FormLabel>
                          <FormControl>
                            <Input className="h-12 bg-background/50 focus:bg-background border-border/60" type="number" placeholder="500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-200">تاريخ البدء</FormLabel>
                          <FormControl>
                            <Input className="h-12 bg-background/50 focus:bg-background border-border/60" type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-200">نوع التعاقد</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 bg-background/50 focus:bg-background border-border/60">
                              <SelectValue placeholder="اختر نوع التعاقد..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="عقد دائم">عقد دائم</SelectItem>
                            <SelectItem value="عقد جزئي">عقد جزئي (Part-time)</SelectItem>
                            <SelectItem value="عقد مؤقت">عقد مؤقت</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 pb-2">
                    <div className="flex items-center gap-4 mb-4">
                      <Separator className="flex-1" />
                      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">إعدادات متقدمة</span>
                      <Separator className="flex-1" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name="probationPeriodDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-200">فترة التجربة (أيام)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-background/50 focus:bg-background border-border/60">
                                  <SelectValue placeholder="اختر فترة التجربة..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="30">30</SelectItem>
                                <SelectItem value="60">60</SelectItem>
                                <SelectItem value="90">90</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="annualLeaveDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-200">أيام الإجازة السنوية</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-background/50 focus:bg-background border-border/60">
                                  <SelectValue placeholder="اختر الإجازة..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="14">14 (الحد الأدنى القانوني)</SelectItem>
                                <SelectItem value="21">21</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="30">30</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name="hasBonus"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 bg-background/50 p-4 h-[72px]">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-semibold text-gray-200">مكافأة الأداء</FormLabel>
                              <div className="text-xs text-muted-foreground">{field.value ? "نعم، مشمولة" : "لا"}</div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hasOvertime"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 bg-background/50 p-4 h-[72px]">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-semibold text-gray-200">العمل الإضافي</FormLabel>
                              <div className="text-xs text-muted-foreground">{field.value ? "نعم، وفق القانون" : "لا"}</div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="specialConditions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-200">شروط خاصة إضافية (اختياري)</FormLabel>
                          <FormControl>
                            <Textarea 
                              className="resize-none bg-background/50 focus:bg-background border-border/60" 
                              placeholder="أي شروط أو بنود إضافية..." 
                              rows={3}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      className="w-full h-14 text-lg font-bold shadow-[0_4px_14px_rgba(212,175,55,0.2)] hover:shadow-[0_6px_20px_rgba(212,175,55,0.3)] transition-all" 
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Spinner className="ml-3 w-5 h-5 text-primary-foreground" /> جاري توليد العقد...
                        </>
                      ) : (
                        "توليد العقد"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card className="h-full border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden min-h-[600px] rounded-2xl relative">
            <CardHeader className="border-b border-border/50 bg-secondary/30 flex flex-row items-center justify-between py-5">
              <div>
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-white">
                  <FileText className="w-6 h-6 text-primary" /> معاينة العقد
                </CardTitle>
              </div>
              {generatedContract && (
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-10 px-4 border-border/60 hover:bg-white/5 transition-colors">
                    {copied ? <Check className="w-4 h-4 ml-2 text-green-500" /> : <Copy className="w-4 h-4 ml-2 text-gray-300" />}
                    {copied ? "تم النسخ" : "نسخ النص"}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleDownloadPdf} className="h-10 px-4 shadow-md">
                    <FileDown className="w-4 h-4 ml-2" />
                    تحميل PDF
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0 relative bg-background/20">
              {isPending ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-md z-10 animate-in fade-in duration-500">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-8"></div>
                    <Scale className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-4 opacity-50" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">صياغة بنود العقد...</h3>
                  <p className="text-primary/80 font-medium">يتم الآن تطبيق المواد القانونية وفق قانون العمل الأردني</p>
                </div>
              ) : null}

              {generatedContract ? (
                <div className="p-8 md:p-12 h-full overflow-y-auto whitespace-pre-wrap leading-loose text-base md:text-lg font-serif text-gray-200">
                  {generatedContract}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center opacity-70">
                  <div className="bg-secondary/40 p-6 rounded-full mb-6 border border-border/50 shadow-inner">
                    <FileText className="w-16 h-16 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-300 mb-2">وثيقة العقد ستظهر هنا</h3>
                  <p className="text-base mt-2 max-w-sm leading-relaxed">
                    الرجاء إدخال البيانات في النموذج والضغط على "توليد العقد". سيتم إنشاء العقد بشكل احترافي وجاهز للاعتماد.
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
