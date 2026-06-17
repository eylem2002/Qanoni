import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          bgcolor: "hsl(43 74% 49% / 0.2)",
          border: "1px solid",
          borderColor: "hsl(43 74% 49% / 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "primary.main",
          flexShrink: 0,
        }}
      >
        {number}
      </Box>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          color: "hsl(43 74% 49% / 0.9)",
          letterSpacing: "0.15em",
        }}
      >
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
    </Box>
  );
}
