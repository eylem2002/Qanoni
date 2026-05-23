import { useState, useRef, useCallback, useEffect } from "react";
import { Scale, Upload, FileText, AlertTriangle, CheckCircle, AlertCircle, X, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

interface Finding {
  status: "green" | "yellow" | "red";
  severity: "safe" | "unusual" | "illegal";
  clause: string;
  finding: string;
  suggestion: string;
}

interface ReviewResult {
  findings: Finding[];
  charCount: number;
  filename: string;
}

const STATUS_CONFIG = {
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    icon: CheckCircle,
    iconColor: "text-green-400",
    label: "آمن",
    labelBg: "bg-green-500/15 text-green-400",
  },
  yellow: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    label: "يحتاج مراجعة",
    labelBg: "bg-amber-500/15 text-amber-400",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: AlertCircle,
    iconColor: "text-red-400",
    label: "خطر قانوني",
    labelBg: "bg-red-500/15 text-red-400",
  },
};

export default function ContractReviewer() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("reviewContract");
    const label = sessionStorage.getItem("reviewContractLabel");
    if (stored && stored.length > 100) {
      sessionStorage.removeItem("reviewContract");
      sessionStorage.removeItem("reviewContractLabel");
      setIsLoading(true);
      fetch("/api/contracts/review-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText: stored, label: label ?? "" }),
      })
        .then((r) => r.json())
        .then((data: { findings?: Finding[]; error?: string }) => {
          if (data.findings) {
            setResult({ findings: data.findings, charCount: stored.length, filename: label ?? "عقد مولَّد" });
            toast({ title: "تمت المراجعة", description: `تم تحليل ${data.findings.length} بنداً` });
          } else {
            toast({ title: "خطأ", description: data.error ?? "فشل التحليل", variant: "destructive" });
          }
        })
        .catch(() => toast({ title: "خطأ في الاتصال", variant: "destructive" } as Parameters<typeof toast>[0]))
        .finally(() => setIsLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptedTypes = ".pdf,.docx,.doc,.txt";

  function validateFile(file: File): boolean {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|doc|txt)$/i)) {
      toast({ title: "نوع ملف غير مدعوم", description: "المقبول: PDF, DOCX, TXT", variant: "destructive" });
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً", description: "الحد الأقصى 5 ميغابايت", variant: "destructive" });
      return false;
    }
    return true;
  }

  function handleFileSelect(file: File) {
    if (!validateFile(file)) return;
    setSelectedFile(file);
    setResult(null);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  async function handleReview() {
    if (!selectedFile) return;
    setIsLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("contract", selectedFile);

    try {
      const res = await fetch("/api/contracts/review", { method: "POST", body: formData });
      const data: { findings?: Finding[]; charCount?: number; filename?: string; error?: string } = await res.json();

      if (!res.ok) {
        toast({ title: "خطأ في المراجعة", description: data.error ?? "حدث خطأ غير متوقع", variant: "destructive" });
        return;
      }

      setResult(data as ReviewResult);
      toast({ title: "تمت المراجعة بنجاح", description: `تم تحليل ${data.findings?.length ?? 0} بنداً` });
    } catch {
      toast({ title: "خطأ في الاتصال", description: "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDownloadReport = async () => {
    if (!result) return;
    setReportLoading(true);
    try {
      const res = await fetch("/api/contracts/export-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings: result.findings, filename: result.filename }),
      });
      if (!res.ok) {
        toast({ title: "خطأ في التصدير", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير-مراجعة-${result.filename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "تم التصدير", description: "تم تحميل تقرير المراجعة بصيغة Word" });
    } catch {
      toast({ title: "خطأ", description: "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setReportLoading(false);
    }
  };

  const filteredFindings = result?.findings.filter((f) => filter === "all" || f.status === filter) ?? [];

  const counts = result
    ? {
        green: result.findings.filter((f) => f.status === "green").length,
        yellow: result.findings.filter((f) => f.status === "yellow").length,
        red: result.findings.filter((f) => f.status === "red").length,
      }
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-3 sm:p-4 md:p-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none -z-10" />

      <header className="w-full max-w-5xl mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 z-10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-2.5 sm:p-3.5 rounded-xl border border-primary/20 shrink-0">
            <Scale className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">مراجع العقود</h1>
            <p className="text-primary/80 text-xs sm:text-sm truncate">ارفع أي عقد أردني — احصل على تقرير مخاطر فوري</p>
          </div>
        </div>
        <a href="/" className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary transition-colors border border-border/50 hover:border-primary/40 rounded-lg px-3 sm:px-4 py-2 self-stretch sm:self-auto shrink-0">
          <FileText className="w-4 h-4" />
          توليد عقد جديد
        </a>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 z-10">
        {/* Upload Panel */}
        <div className="lg:col-span-5">
          <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl rounded-2xl">
            <CardHeader className="bg-secondary/30 border-b border-border/50 pb-5">
              <CardTitle className="text-lg font-bold text-white">رفع العقد</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                المقبول: PDF, Word (.docx), نص عادي (.txt) — حتى 5 ميغابايت
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-primary bg-primary/10"
                    : selectedFile
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-border/60 bg-background/30 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedTypes}
                  className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-green-400" />
                    <p className="text-sm font-medium text-green-400 break-all">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setResult(null); }}
                      className="mt-1 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      <X className="w-3 h-3" /> إزالة الملف
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-10 h-10 text-muted-foreground/60" />
                    <div>
                      <p className="text-sm font-medium text-gray-300">اسحب الملف هنا أو انقر للاختيار</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT — حتى 5 MB</p>
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={handleReview} disabled={!selectedFile || isLoading} className="w-full h-12 text-base font-bold">
                {isLoading
                  ? <><Spinner className="ml-3 w-5 h-5 text-primary-foreground" />جاري تحليل العقد...</>
                  : "مراجعة العقد"}
              </Button>

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-xs text-blue-300/80 leading-relaxed">
                  يقوم الذكاء الاصطناعي بمراجعة البنود وتصنيفها إلى: آمن (أخضر)، يحتاج مراجعة (أصفر)، أو خطر قانوني (أحمر). هذه المراجعة لأغراض إرشادية فقط — لا تُغني عن محامٍ مرخص.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7">
          <Card className="h-full border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl flex flex-col rounded-2xl min-h-[500px]">
            <CardHeader className="border-b border-border/50 bg-secondary/30 py-4 shrink-0">
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  تقرير المخاطر
                </CardTitle>
                {result && (
                  <Button variant="default" size="sm" onClick={handleDownloadReport} disabled={reportLoading} className="h-8 px-3 text-xs">
                    {reportLoading
                      ? <><Spinner className="ml-1.5 w-3 h-3 text-primary-foreground" />جاري التصدير...</>
                      : <><FileDown className="w-3.5 h-3.5 ml-1.5" />تحميل التقرير</>
                    }
                  </Button>
                )}
              </div>
            </CardHeader>

            {counts && (
              <div className="border-b border-border/50 px-5 py-3 flex items-center gap-3 flex-wrap bg-secondary/10 shrink-0">
                <span className="text-xs text-muted-foreground ml-1">تصفية:</span>
                {(["all", "red", "yellow", "green"] as const).map((f) => {
                  const label =
                    f === "all" ? `الكل (${result!.findings.length})` :
                    f === "red" ? `خطر (${counts.red})` :
                    f === "yellow" ? `مراجعة (${counts.yellow})` :
                    `آمن (${counts.green})`;
                  const colors =
                    f === "red" ? "border-red-500/40 text-red-400 data-[active=true]:bg-red-500/15" :
                    f === "yellow" ? "border-amber-500/40 text-amber-400 data-[active=true]:bg-amber-500/15" :
                    f === "green" ? "border-green-500/40 text-green-400 data-[active=true]:bg-green-500/15" :
                    "border-border/60 text-muted-foreground data-[active=true]:bg-secondary";
                  return (
                    <button
                      key={f}
                      data-active={filter === f}
                      onClick={() => setFilter(f)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${colors}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <CardContent className="flex-1 p-0 overflow-hidden">
              {isLoading && (
                <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Scale className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-white">جاري تحليل بنود العقد...</p>
                    <p className="text-sm text-muted-foreground mt-1">يتم فحص كل بند مقابل القانون الأردني</p>
                  </div>
                </div>
              )}

              {!isLoading && !result && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-70">
                  <div className="bg-secondary/40 p-5 rounded-full mb-4 border border-border/50">
                    <FileText className="w-12 h-12 text-muted-foreground/60" />
                  </div>
                  <p className="font-bold text-gray-300">ارفع عقداً لتبدأ المراجعة</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                    يدعم النظام أي عقد أردني — عمل، إيجار، خدمات، توريد، أو غير ذلك
                  </p>
                </div>
              )}

              {!isLoading && result && (
                <div className="h-full overflow-y-auto p-5 space-y-3">
                  {filteredFindings.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">لا توجد نتائج لهذا التصنيف</p>
                  ) : (
                    filteredFindings.map((f, i) => {
                      const cfg = STATUS_CONFIG[f.status];
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 shrink-0 ${cfg.iconColor}`} />
                              <span className="text-sm font-bold text-white">{f.clause}</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.labelBg}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed mb-2">{f.finding}</p>
                          {f.suggestion && f.suggestion !== "لا يلزم تغيير." && (
                            <div className="border-t border-white/10 pt-2 mt-2">
                              <p className="text-xs text-muted-foreground">
                                <span className="text-primary/80 font-medium">التوصية: </span>
                                {f.suggestion}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
