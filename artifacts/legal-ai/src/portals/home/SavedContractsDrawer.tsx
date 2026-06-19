import { useState } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { X, FileText, AlertTriangle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppDispatch } from "@/app/store/hooks";
import { setLoadedContract } from "@/app/store/slices/contractSlice";
import {
  fetchSavedContracts,
  fetchSavedContract,
  type SavedContractSummary,
} from "@/domains/contracts/contractsApi";
import { CONTRACT_TYPE_LABEL } from "@/domains/contracts/constants";
import type { ContractType } from "@/domains/contracts/constants";
import { useToast } from "@/hooks/useToast";

function partyNameFromInput(
  contractType: string,
  inputData: Record<string, unknown> | null,
): string {
  if (!inputData) return "";
  const map: Record<string, string> = {
    employment: "employeeName",
    rental: "tenantName",
    service: "clientName",
    nda: "partyOneName",
    supplier: "supplierName",
  };
  const key = map[contractType];
  return key ? String(inputData[key] ?? "") : "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-JO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ContractRow({
  item,
  onSelect,
}: {
  item: SavedContractSummary;
  onSelect: (id: string) => void;
}) {
  const label =
    CONTRACT_TYPE_LABEL[item.contractType as ContractType] ?? item.contractType;

  return (
    <Box
      onClick={() => onSelect(item.id)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.5,
        cursor: "pointer",
        borderRadius: 2,
        transition: "background .15s",
        "&:hover": { bgcolor: "hsl(43 74% 49% / 0.08)" },
      }}
    >
      <Box
        sx={{
          p: 0.75,
          borderRadius: 1.5,
          bgcolor: "hsl(43 74% 49% / 0.12)",
          display: "flex",
          flexShrink: 0,
        }}
      >
        <FileText size={16} color="hsl(43 74% 49%)" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}>
          {label}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
          <Clock size={11} color="text.secondary" />
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
            {formatDate(item.createdAt)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SavedContractsDrawer({ open, onClose }: Props) {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["saved-contracts"],
    queryFn: fetchSavedContracts,
    enabled: open,
    staleTime: 30_000,
  });

  const handleSelect = async (id: string) => {
    setLoadingId(id);
    try {
      const detail = await fetchSavedContract(id);
      if (!detail) {
        toast({ title: "خطأ", description: "تعذر تحميل العقد", variant: "destructive" });
        return;
      }
      dispatch(
        setLoadedContract({
          contract: detail.contract.generatedText,
          partyName: partyNameFromInput(detail.contract.contractType, detail.contract.inputData),
          contractType: detail.contract.contractType as ContractType,
          stale: detail.stale,
          changedLaws: detail.changedLaws,
        }),
      );
      onClose();
    } catch {
      toast({ title: "خطأ في الاتصال", description: "تعذر تحميل العقد", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 360 },
          bgcolor: "background.default",
          borderLeft: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "text.primary" }}>
          العقود المحفوظة
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="إغلاق">
          <X size={18} />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
            <CircularProgress size={28} sx={{ color: "hsl(43 74% 49%)" }} />
          </Box>
        ) : contracts.length === 0 ? (
          <Box sx={{ textAlign: "center", pt: 6, px: 3 }}>
            <FileText size={36} color="hsl(43 74% 49% / 0.4)" style={{ margin: "0 auto 12px" }} />
            <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
              لا توجد عقود محفوظة بعد.
              <br />
              أنشئ عقداً وسيُحفظ تلقائياً هنا.
            </Typography>
          </Box>
        ) : (
          <>
            {contracts.map((item, i) => (
              <Box key={item.id}>
                {loadingId === item.id ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={20} sx={{ color: "hsl(43 74% 49%)" }} />
                  </Box>
                ) : (
                  <ContractRow item={item} onSelect={handleSelect} />
                )}
                {i < contracts.length - 1 && <Divider sx={{ mx: 2, opacity: 0.3 }} />}
              </Box>
            ))}
          </>
        )}
      </Box>

      {/* Footer hint */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <AlertTriangle size={13} color="hsl(43 74% 49% / 0.7)" />
        <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
          العقود المبنية على قوانين قديمة ستظهر بتحذير عند الفتح.
        </Typography>
      </Box>
    </Drawer>
  );
}
