import { createTheme } from "@mui/material/styles";

/* Dark luxury palette — navy base + rich gold, mirrored from the original
   design tokens (hsl 224 45% … navy, hsl 43 74% 49% gold). */
const navyBg = "hsl(224 45% 8%)";
const navyPaper = "hsl(224 45% 10%)";
const gold = "hsl(43 74% 49%)";
const textPrimary = "hsl(210 40% 98%)";
const textSecondary = "hsl(215 20% 65%)";

export const COLORS = {
  navyBg,
  navyPaper,
  gold,
  border: "hsl(224 45% 15%)",
  inputBg: "hsl(224 45% 8% / 0.5)",
  cardBg: "hsl(224 45% 10% / 0.6)",
  cardBgFaint: "hsl(224 45% 10% / 0.4)",
  secondaryBg: "hsl(224 45% 15% / 0.3)",
} as const;

export const theme = createTheme({
  direction: "rtl",
  palette: {
    mode: "dark",
    primary: { main: gold, contrastText: navyBg },
    secondary: { main: "hsl(224 45% 15%)", contrastText: textPrimary },
    background: { default: navyBg, paper: navyPaper },
    text: { primary: textPrimary, secondary: textSecondary },
    divider: "hsl(224 45% 15% / 0.6)",
    error: { main: "hsl(0 72% 60%)" },
    warning: { main: "hsl(43 96% 56%)" },
    success: { main: "hsl(142 71% 45%)" },
    info: { main: "hsl(213 94% 68%)" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'Cairo', sans-serif",
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: navyBg, color: textPrimary },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiButton: {
      defaultProps: { variant: "contained", disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, fontWeight: 700 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: COLORS.inputBg, borderRadius: 8 },
      },
    },
  },
});
