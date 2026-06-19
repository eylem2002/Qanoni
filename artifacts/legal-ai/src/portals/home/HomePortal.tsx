import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText, FolderOpen, Bell } from "lucide-react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";
import { useQuery } from "@tanstack/react-query";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { setContractType, clearResult } from "@/app/store/slices/contractSlice";
import { setAdvancedOpen } from "@/app/store/slices/uiSlice";
import { CONTRACT_TYPES } from "@/domains/contracts/constants";
import { fetchLawChangeCount } from "@/domains/contracts/contractsApi";
import { EmploymentForm } from "@/domains/contracts/forms/EmploymentForm";
import { RentalForm } from "@/domains/contracts/forms/RentalForm";
import { ServiceForm } from "@/domains/contracts/forms/ServiceForm";
import { NdaForm } from "@/domains/contracts/forms/NdaForm";
import { SupplierForm } from "@/domains/contracts/forms/SupplierForm";
import { PageShell } from "@/components/layout/PageShell";
import { LogoutButton } from "@/app/auth/LogoutButton";
import { ContractPreview } from "./ContractPreview";
import { SavedContractsDrawer } from "./SavedContractsDrawer";

function ActiveForm() {
  const contractType = useAppSelector((s) => s.contract.contractType);
  switch (contractType) {
    case "employment":
      return <EmploymentForm />;
    case "rental":
      return <RentalForm />;
    case "service":
      return <ServiceForm />;
    case "nda":
      return <NdaForm />;
    case "supplier":
      return <SupplierForm />;
    default:
      return <EmploymentForm />;
  }
}

const headerNavSx = {
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
  transition: "all .2s",
  cursor: "pointer",
  background: "none",
  font: "inherit",
  "&:hover": { color: "primary.main", borderColor: "primary.main" },
} as const;

export function HomePortal() {
  const dispatch = useAppDispatch();
  const contractType = useAppSelector((s) => s.contract.contractType);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: lawChangeCount = 0 } = useQuery({
    queryKey: ["law-change-count"],
    queryFn: fetchLawChangeCount,
    refetchInterval: 5 * 60 * 1000, // poll every 5 minutes
    staleTime: 60_000,
  });

  const headerActions = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      {/* Saved contracts */}
      <Box component="button" type="button" onClick={() => setDrawerOpen(true)} sx={headerNavSx}>
        <FolderOpen size={16} />
        العقود المحفوظة
      </Box>

      {/* Review contracts */}
      <Box
        component={Link}
        to="/review"
        sx={headerNavSx}
      >
        <FileText size={16} />
        مراجع العقود
      </Box>

      {/* Law-change notification bell */}
      {lawChangeCount > 0 && (
        <Badge
          badgeContent={lawChangeCount}
          color="warning"
          sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 16, height: 16 } }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1,
              border: "1px solid",
              borderColor: "hsl(48 96% 53% / 0.5)",
              borderRadius: 2,
              color: "hsl(48 96% 53%)",
            }}
            title="توجد تغييرات في القوانين غير مراجَعة"
          >
            <Bell size={16} />
          </Box>
        </Badge>
      )}

      <LogoutButton />
    </Box>
  );

  return (
    <>
      <PageShell
        title="قانوني AI"
        subtitle="منصة توليد العقود القانونية - الأردن"
        headerAction={headerActions}
        maxWidth={1152}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "5fr 7fr" },
            gap: { xs: 2, md: 4 },
          }}
        >
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "hsl(224 45% 10% / 0.6)",
              backdropFilter: "blur(16px)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <Box sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "hsl(224 45% 14% / 0.3)", px: 3, py: 2.5 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>بيانات العقد</Typography>
              <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
                أدخل البيانات لتوليد عقد قانوني أردني في ثوانٍ.
              </Typography>
            </Box>

            <Box sx={{ p: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.82)", mb: 1 }}>نوع الوثيقة</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(5, 1fr)" }, gap: 1 }}>
                  {CONTRACT_TYPES.map((t) => {
                    const active = contractType === t.value;
                    return (
                      <Box
                        key={t.value}
                        component="button"
                        type="button"
                        onClick={() => {
                          dispatch(setContractType(t.value));
                          dispatch(clearResult());
                          dispatch(setAdvancedOpen(false));
                        }}
                        sx={{
                          borderRadius: 2,
                          border: "1px solid",
                          px: 1,
                          py: 1.25,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "center",
                          font: "inherit",
                          transition: "all .2s",
                          borderColor: active ? "primary.main" : "divider",
                          bgcolor: active ? "hsl(43 96% 56% / 0.1)" : "hsl(224 45% 8% / 0.3)",
                          color: active ? "primary.main" : "text.secondary",
                          "&:hover": { borderColor: active ? "primary.main" : "hsl(43 96% 56% / 0.4)" },
                        }}
                      >
                        {t.label}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <ActiveForm />
            </Box>
          </Box>

          <ContractPreview />
        </Box>
      </PageShell>

      <SavedContractsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
