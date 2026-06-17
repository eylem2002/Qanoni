import { LogOut } from "lucide-react";
import Box from "@mui/material/Box";

import { useAppDispatch } from "@/app/store/hooks";
import { setUnauthenticated } from "@/app/store/slices/authSlice";
import { apiLogout } from "@/domains/auth/authApi";

export function LogoutButton() {
  const dispatch = useAppDispatch();

  async function handleLogout() {
    await apiLogout().catch(() => undefined);
    dispatch(setUnauthenticated());
  }

  return (
    <Box
      component="button"
      type="button"
      onClick={handleLogout}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        fontSize: 14,
        fontWeight: 500,
        color: "text.secondary",
        background: "none",
        cursor: "pointer",
        font: "inherit",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        px: 2,
        py: 1,
        transition: "all .2s",
        "&:hover": { color: "hsl(0 84% 70%)", borderColor: "hsl(0 84% 60% / 0.5)" },
      }}
    >
      <LogOut className="w-4 h-4" />
      تسجيل الخروج
    </Box>
  );
}
