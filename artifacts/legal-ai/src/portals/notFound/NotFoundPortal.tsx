import { Link } from "react-router-dom";
import { Scale } from "lucide-react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

export function NotFoundPortal() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 4,
        textAlign: "center",
      }}
    >
      <Scale className="w-12 h-12" style={{ color: "var(--gold, #d4af37)", opacity: 0.6 }} />
      <Typography sx={{ fontSize: 48, fontWeight: 800, color: "#fff" }}>٤٠٤</Typography>
      <Typography sx={{ fontSize: 18, color: "text.secondary" }}>الصفحة غير موجودة</Typography>
      <Button component={Link} to="/" variant="contained" sx={{ mt: 1 }}>
        العودة للرئيسية
      </Button>
    </Box>
  );
}
