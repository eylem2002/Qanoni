import type { ReactNode } from "react";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { rtlCache } from "@/app/theme/rtlCache";
import { theme } from "@/app/theme/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <CacheProvider value={rtlCache}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </CacheProvider>
  );
}
