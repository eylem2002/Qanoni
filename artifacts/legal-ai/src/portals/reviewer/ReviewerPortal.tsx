import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Scale, Upload, FileText, AlertTriangle, CheckCircle, AlertCircle, X, FileDown } from "lucide-react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { useToast } from "@/hooks/useToast";
import { reviewText, reviewFile, exportReport } from "@/domains/review/reviewApi";
import type { Finding, ReviewResult } from "@/domains/review/types";
import { downloadBlob } from "@/lib/download";
import { PageShell } from "@/components/layout/PageShell";
import { Spinner } from "@/components/Spinner";
import { LogoutButton } from "@/app/auth/LogoutButton";

type StatusKey = "green" | "yellow" | "red";

const STATUS_CONFIG: Record<StatusKey, { icon: typeof CheckCircle; color: string; label: string }> = {
  green: { icon: CheckCircle, color: "hsl(142 71% 45%)", label: "آمن" },
  yellow: { icon: AlertTriangle, color: "hsl(43 96% 56%)", label: "يحتاج مراجعة" },
  red: { icon: AlertCircle, color: "hsl(0 84% 60%)", label: "خطر قانوني" },
};

const acceptedTypes = ".pdf,.docx,.doc,.txt";

export function ReviewerPortal() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [filter, setFilter] = useState<"all" | StatusKey>("all");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("reviewContract");
    const label = sessionStorage.getItem("reviewContractLabel");
    if (stored && stored.length > 100) {
      sessionStorage.removeItem("reviewContract");
      sessionStorage.removeItem("reviewContractLabel");
      setIsLoading(true);
      reviewText({ contractText: stored, label: label ?? "" })
        .then((data) => {
          if (data.findings) {
            setResult({ findings: data.findings, charCount: stored.length, filename: label ?? "عقد مولَّد" });
            toast({ title: "تمت المراجعة", description: `تم تحليل ${data.findings.length} بنداً` });
          } else {
            toast({ title: "خطأ", description: data.error ?? "فشل التحليل", variant: "destructive" });
          }
        })
        .catch(() => toast({ title: "خطأ في الاتصال", variant: "destructive" }))
        .finally(() => setIsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    try {
      const { ok, data } = await reviewFile(selectedFile);
      if (!ok) {
        toast({ title: "خطأ في المراجعة", description: data.error ?? "حدث خطأ غير متوقع", variant: "destructive" });
        return;
      }
      setResult({
        findings: data.findings ?? [],
        charCount: data.charCount ?? 0,
        filename: data.filename ?? selectedFile.name,
      });
      toast({ title: "تمت المراجعة بنجاح", description: `تم تحليل ${data.findings?.length ?? 0} بنداً` });
    } catch {
      toast({ title: "خطأ في الاتصال", description: "تعذر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownloadReport() {
    if (!result) return;
    setReportLoading(true);
    try {
      const blob = await exportReport({ findings: result.findings, filename: result.filename });
      downloadBlob(blob, `تقرير-مراجعة-${result.filename}.docx`);
      toast({ title: "تم التصدير", description: "تم تحميل تقرير المراجعة بصيغة Word" });
    } catch {
      toast({ title: "خطأ في التصدير", variant: "destructive" });
    } finally {
      setReportLoading(false);
    }
  }

  const filteredFindings = result?.findings.filter((f) => filter === "all" || f.status === filter) ?? [];
  const counts = result
    ? {
        green: result.findings.filter((f) => f.status === "green").length,
        yellow: result.findings.filter((f) => f.status === "yellow").length,
        red: result.findings.filter((f) => f.status === "red").length,
      }
    : null;

  const headerAction = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <Box
        component={Link}
        to="/"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontSize: 14,
          fontWeight: 500,
          color: "text.secondary",
          textDecoration: "none",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          px: 2,
          py: 1,
          "&:hover": { color: "primary.main", borderColor: "primary.main" },
        }}
      >
        <FileText className="w-4 h-4" />
        توليد عقد جديد
      </Box>
      <LogoutButton />
    </Box>
  );

  const filterPills = (["all", "red", "yellow", "green"] as const).map((f) => {
    const label =
      f === "all" ? `الكل (${result!.findings.length})` :
      f === "red" ? `خطر (${counts!.red})` :
      f === "yellow" ? `مراجعة (${counts!.yellow})` :
      `آمن (${counts!.green})`;
    const color =
      f === "all" ? "rgba(255,255,255,0.6)" :
      STATUS_CONFIG[f].color;
    const active = filter === f;
    return (
      <Box
        key={f}
        component="button"
        type="button"
        onClick={() => setFilter(f)}
        sx={{
          fontSize: 12,
          px: 1.5,
          py: 0.5,
          borderRadius: 99,
          border: "1px solid",
          cursor: "pointer",
          font: "inherit",
          color,
          borderColor: active ? color : "divider",
          bgcolor: active ? `${color}26` : "transparent",
          transition: "all .2s",
        }}
      >
        {label}
      </Box>
    );
  });

  return (
    <PageShell title="مراجع العقود" subtitle="ارفع أي عقد أردني — احصل على تقرير مخاطر فوري" headerAction={headerAction}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "5fr 7fr" }, gap: { xs: 2, md: 4 } }}>
        {/* Upload panel */}
        <Box sx={{ border: "1px solid", borderColor: "divider", bgcolor: "hsl(224 45% 10% / 0.6)", backdropFilter: "blur(16px)", borderRadius: 4, overflow: "hidden" }}>
          <Box sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "hsl(224 45% 14% / 0.3)", px: 3, py: 2.5 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>رفع العقد</Typography>
            <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
              المقبول: PDF, Word (.docx), نص عادي (.txt) — حتى 5 ميغابايت
            </Typography>
          </Box>
          <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                position: "relative",
                border: "2px dashed",
                borderRadius: 3,
                p: 4,
                textAlign: "center",
                cursor: "pointer",
                transition: "all .2s",
                borderColor: dragOver ? "primary.main" : selectedFile ? "hsl(142 71% 45% / 0.4)" : "divider",
                bgcolor: dragOver ? "hsl(43 96% 56% / 0.1)" : selectedFile ? "hsl(142 71% 45% / 0.05)" : "hsl(224 45% 8% / 0.3)",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                style={{ display: "none" }}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }}
              />
              {selectedFile ? (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <FileText className="w-10 h-10" style={{ color: "hsl(142 71% 55%)" }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: "hsl(142 71% 65%)", wordBreak: "break-all" }}>{selectedFile.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{(selectedFile.size / 1024).toFixed(1)} KB</Typography>
                  <Box
                    component="button"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setResult(null); }}
                    sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 0.5, fontSize: 12, color: "hsl(0 84% 70%)", background: "none", border: "none", cursor: "pointer", font: "inherit" }}
                  >
                    <X className="w-3 h-3" /> إزالة الملف
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                  <Upload className="w-10 h-10" style={{ opacity: 0.6 }} />
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>اسحب الملف هنا أو انقر للاختيار</Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>PDF, DOCX, TXT — حتى 5 MB</Typography>
                  </Box>
                </Box>
              )}
            </Box>

            <Button onClick={handleReview} disabled={!selectedFile || isLoading} fullWidth sx={{ height: 48, fontSize: 16 }}>
              {isLoading ? (<><Spinner size={20} /><Box component="span" sx={{ ml: 1.5 }}>جاري تحليل العقد...</Box></>) : "مراجعة العقد"}
            </Button>

            <Box sx={{ borderRadius: 2, border: "1px solid", borderColor: "hsl(217 91% 60% / 0.2)", bgcolor: "hsl(217 91% 60% / 0.05)", p: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: "hsl(217 91% 78% / 0.8)", lineHeight: 1.7 }}>
                يقوم الذكاء الاصطناعي بمراجعة البنود وتصنيفها إلى: آمن (أخضر)، يحتاج مراجعة (أصفر)، أو خطر قانوني (أحمر). هذه المراجعة لأغراض إرشادية فقط — لا تُغني عن محامٍ مرخص.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Results panel */}
        <Box sx={{ height: "100%", minHeight: 500, display: "flex", flexDirection: "column", border: "1px solid", borderColor: "divider", bgcolor: "hsl(224 45% 10% / 0.4)", backdropFilter: "blur(16px)", borderRadius: 4, overflow: "hidden" }}>
          <Box sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "hsl(224 45% 14% / 0.3)", px: 2.5, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 1 }}>
              <FileText className="w-5 h-5" style={{ color: "var(--gold, #d4af37)" }} />
              تقرير المخاطر
            </Typography>
            {result && (
              <Button size="small" variant="contained" onClick={handleDownloadReport} disabled={reportLoading} sx={{ fontSize: 12 }}>
                {reportLoading ? (<><Spinner size={14} /><Box component="span" sx={{ ml: 1 }}>جاري التصدير...</Box></>) : (<><FileDown className="w-3.5 h-3.5" style={{ marginLeft: 6 }} />تحميل التقرير</>)}
              </Button>
            )}
          </Box>

          {counts && (
            <Box sx={{ borderBottom: "1px solid", borderColor: "divider", px: 2.5, py: 1.5, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", bgcolor: "hsl(224 45% 14% / 0.1)" }}>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>تصفية:</Typography>
              {filterPills}
            </Box>
          )}

          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {isLoading && (
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, p: 4 }}>
                <Box sx={{ position: "relative" }}>
                  <Box sx={{ width: 64, height: 64, borderRadius: "50%", border: "4px solid", borderColor: "hsl(43 96% 56% / 0.2)", borderTopColor: "primary.main", animation: "spin 1s linear infinite", "@keyframes spin": { to: { transform: "rotate(360deg)" } } }} />
                  <Scale className="w-6 h-6" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", opacity: 0.5, color: "var(--gold, #d4af37)" }} />
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 700, color: "#fff" }}>جاري تحليل بنود العقد...</Typography>
                  <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>يتم فحص كل بند مقابل القانون الأردني</Typography>
                </Box>
              </Box>
            )}

            {!isLoading && !result && (
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", p: 4, opacity: 0.7 }}>
                <Box sx={{ bgcolor: "hsl(224 45% 14% / 0.4)", p: 2.5, borderRadius: "50%", mb: 2, border: "1px solid", borderColor: "divider" }}>
                  <FileText className="w-12 h-12" style={{ opacity: 0.6 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>ارفع عقداً لتبدأ المراجعة</Typography>
                <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 1, maxWidth: 320 }}>
                  يدعم النظام أي عقد أردني — عمل، إيجار، خدمات، توريد، أو غير ذلك
                </Typography>
              </Box>
            )}

            {!isLoading && result && (
              <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {filteredFindings.length === 0 ? (
                  <Typography sx={{ textAlign: "center", fontSize: 14, color: "text.secondary", py: 4 }}>لا توجد نتائج لهذا التصنيف</Typography>
                ) : (
                  filteredFindings.map((f, i) => <FindingCard key={i} finding={f} />)
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </PageShell>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const cfg = STATUS_CONFIG[finding.status];
  const Icon = cfg.icon;
  return (
    <Box sx={{ borderRadius: 3, border: "1px solid", p: 2, borderColor: `${cfg.color}4D`, bgcolor: `${cfg.color}1A` }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Icon className="w-4 h-4" style={{ flexShrink: 0, color: cfg.color }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{finding.clause}</Typography>
        </Box>
        <Box component="span" sx={{ fontSize: 12, px: 1, py: 0.25, borderRadius: 99, fontWeight: 500, flexShrink: 0, color: cfg.color, bgcolor: `${cfg.color}26` }}>
          {cfg.label}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, mb: 1 }}>{finding.finding}</Typography>
      {finding.suggestion && finding.suggestion !== "لا يلزم تغيير." && (
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.1)", pt: 1, mt: 1 }}>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            <Box component="span" sx={{ color: "primary.main", fontWeight: 500 }}>التوصية: </Box>
            {finding.suggestion}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
