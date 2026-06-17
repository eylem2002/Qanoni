import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function PageShell({
  title,
  subtitle,
  headerAction,
  maxWidth = 1152,
  children,
}: {
  title: string;
  subtitle: string;
  headerAction?: ReactNode;
  maxWidth?: number;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        p: { xs: 1.5, sm: 2, md: 5 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          insetInlineStart: 0,
          width: "100%",
          height: 384,
          background: "linear-gradient(to bottom, hsl(43 74% 49% / 0.1), transparent)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <Box
        component="header"
        sx={{
          width: "100%",
          maxWidth,
          mb: { xs: 3, md: 5 },
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          zIndex: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
          <Box
            sx={{
              background: "linear-gradient(135deg, hsl(43 74% 49% / 0.2), hsl(43 74% 49% / 0.05))",
              p: { xs: 1.25, sm: 1.75 },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "hsl(43 74% 49% / 0.2)",
              boxShadow: "0 0 20px hsl(43 74% 49% / 0.15)",
              flexShrink: 0,
            }}
          >
            <Scale style={{ color: "hsl(43 74% 49%)" }} className="w-7 h-7" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{ fontSize: { xs: 20, sm: 24, md: 28 }, fontWeight: 800, color: "#fff", mb: 0.25 }}
            >
              {title}
            </Typography>
            <Typography
              sx={{ color: "hsl(43 74% 49% / 0.85)", fontWeight: 500, fontSize: { xs: 12, sm: 14 } }}
              noWrap
            >
              {subtitle}
            </Typography>
          </Box>
        </Box>
        {headerAction}
      </Box>

      <Box component="main" sx={{ width: "100%", maxWidth, zIndex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
