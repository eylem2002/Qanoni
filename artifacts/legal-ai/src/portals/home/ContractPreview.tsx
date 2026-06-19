import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Scale, Copy, Check, FileDown, MessageCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { useToast } from "@/hooks/useToast";
import { useAppSelector } from "@/app/store/hooks";
import { exportContractWord } from "@/domains/contracts/contractsApi";
import { downloadBlob } from "@/lib/download";
import { CONTRACT_TYPE_LABEL, LOADING_MESSAGES } from "@/domains/contracts/constants";
import { Spinner } from "@/components/Spinner";

export function ContractPreview() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const generatedContract = useAppSelector((s) => s.contract.generatedContract);
  const validationWarnings = useAppSelector((s) => s.contract.validationWarnings);
  const contractType = useAppSelector((s) => s.contract.contractType);
  const partyName = useAppSelector((s) => s.contract.partyName);
  const isGenerating = useAppSelector((s) => s.contract.isGenerating);
  const stale = useAppSelector((s) => s.contract.stale);

  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleCopy = () => {
    if (!generatedContract) return;
    navigator.clipboard.writeText(generatedContract).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "تم النسخ", description: "تم نسخ العقد إلى الحافظة" });
    });
  };

  const handleExportWord = async () => {
    if (!generatedContract) return;
    setExporting(true);
    try {
      const blob = await exportContractWord({
        contractText: generatedContract,
        contractTypeLabel: CONTRACT_TYPE_LABEL[contractType],
        partyName,
      });
      downloadBlob(blob, `عقد-${CONTRACT_TYPE_LABEL[contractType]}.docx`);
      toast({ title: "تم التصدير", description: "تم تحميل العقد بصيغة Word" });
    } catch {
      toast({ title: "خطأ في التصدير", description: "تعذر تصدير العقد", variant: "destructive" });
    } finally {
      setExporting(false);
    }
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
      toast({ title: "تعذر النسخ", description: "الرجاء نسخ العقد يدوياً ثم مشاركته عبر واتساب.", variant: "destructive" });
    });
  };

  const handleReview = () => {
    if (!generatedContract) return;
    sessionStorage.setItem("reviewContract", generatedContract);
    sessionStorage.setItem("reviewContractLabel", CONTRACT_TYPE_LABEL[contractType]);
    navigate("/review");
  };

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 500,
        display: "flex",
        flexDirection: "column",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "hsl(224 45% 10% / 0.4)",
        backdropFilter: "blur(16px)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "hsl(224 45% 14% / 0.3)",
          px: 2.5,
          py: 2,
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 1 }}>
          <FileText className="w-5 h-5" style={{ color: "var(--gold, #d4af37)" }} />
          العقد المُولَّد
        </Typography>
        {generatedContract && !isGenerating && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" onClick={handleCopy} sx={{ minWidth: 0, px: 1.5 }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
            <Button size="small" variant="outlined" onClick={handleExportWord} disabled={exporting} sx={{ minWidth: 0, px: 1.5 }}>
              {exporting ? <Spinner size={14} /> : <FileDown className="w-3.5 h-3.5" />}
            </Button>
            <Button size="small" variant="outlined" onClick={handleWhatsApp} sx={{ minWidth: 0, px: 1.5 }}>
              <MessageCircle className="w-3.5 h-3.5" />
            </Button>
            <Button size="small" variant="contained" onClick={handleReview} sx={{ fontSize: 12, px: 1.5 }}>
              <ShieldCheck className="w-3.5 h-3.5" style={{ marginLeft: 6 }} />
              مراجعة
            </Button>
          </Box>
        )}
      </Box>

      {stale && !isGenerating && (
        <Box sx={{ borderBottom: "1px solid", borderColor: "hsl(48 96% 53% / 0.4)", bgcolor: "hsl(48 96% 53% / 0.08)", px: 2.5, py: 1.5, display: "flex", alignItems: "flex-start", gap: 1 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2, color: "hsl(48 96% 70%)" }} />
          <Typography sx={{ fontSize: 12, color: "hsl(48 96% 75%)", lineHeight: 1.6 }}>
            هذا العقد مبني على نسخة قديمة من القانون. يُنصح بإعادة توليد العقد للتأكد من توافقه مع التعديلات القانونية الأخيرة.
          </Typography>
        </Box>
      )}

      {validationWarnings.length > 0 && !isGenerating && (
        <Box sx={{ borderBottom: "1px solid", borderColor: "hsl(43 96% 56% / 0.3)", bgcolor: "hsl(43 96% 56% / 0.08)", px: 2.5, py: 1.5 }}>
          {validationWarnings.map((w, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1, fontSize: 12, color: "hsl(43 96% 70%)" }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ flexShrink: 0, marginTop: 2 }} />
              {w}
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {generatedContract ? (
          <Box sx={{ p: 3 }}>
            <Typography
              component="pre"
              sx={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "inherit",
                fontSize: 14,
                lineHeight: 1.9,
                color: "rgba(255,255,255,0.9)",
                m: 0,
              }}
            >
              {generatedContract}
            </Typography>
          </Box>
        ) : (
          !isGenerating && (
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", p: 4, opacity: 0.7 }}>
              <Box sx={{ bgcolor: "hsl(224 45% 14% / 0.4)", p: 2.5, borderRadius: "50%", mb: 2, border: "1px solid", borderColor: "divider" }}>
                <FileText className="w-12 h-12" style={{ opacity: 0.6 }} />
              </Box>
              <Typography sx={{ fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>سيظهر العقد المُولَّد هنا</Typography>
              <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 1, maxWidth: 320 }}>
                املأ البيانات على اليمين واضغط توليد العقد للحصول على عقد أردني متوافق مع القانون
              </Typography>
            </Box>
          )
        )}

        {isGenerating && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2.5,
              p: 4,
              bgcolor: "hsl(224 45% 10% / 0.8)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Box sx={{ position: "relative" }}>
              <Box sx={{ width: 64, height: 64, borderRadius: "50%", border: "4px solid", borderColor: "hsl(43 96% 56% / 0.2)", borderTopColor: "primary.main", animation: "spin 1s linear infinite", "@keyframes spin": { to: { transform: "rotate(360deg)" } } }} />
              <Scale className="w-6 h-6" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", opacity: 0.5, color: "var(--gold, #d4af37)" }} />
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography sx={{ fontWeight: 700, color: "#fff" }}>{LOADING_MESSAGES[contractType]}</Typography>
              <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>قد يستغرق ذلك حتى دقيقة</Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ borderTop: "1px solid", borderColor: "hsl(217 91% 60% / 0.2)", bgcolor: "hsl(217 91% 60% / 0.05)", px: 2.5, py: 1.25 }}>
        <Typography sx={{ fontSize: 11, color: "hsl(217 91% 78% / 0.8)", lineHeight: 1.6 }}>
          هذا العقد مُولَّد آلياً لأغراض إرشادية. البنود القانونية الإلزامية مبنية على القانون الأردني لكنها بحاجة لمراجعة محامٍ مرخص قبل الاعتماد.
        </Typography>
      </Box>
    </Box>
  );
}
