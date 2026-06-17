import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function FieldLabel({
  label,
  required,
  hint,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
}) {
  return (
    <Typography
      component="label"
      sx={{
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: "rgba(255,255,255,0.78)",
        mb: 0.75,
      }}
    >
      {label}
      {required && (
        <Box component="span" sx={{ color: "error.main" }}>
          {" *"}
        </Box>
      )}
      {hint && (
        <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
          {" "}
          {hint}
        </Box>
      )}
    </Typography>
  );
}
