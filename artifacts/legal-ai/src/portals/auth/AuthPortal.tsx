import { useState } from "react";
import { Scale } from "lucide-react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

import { useAppDispatch } from "@/app/store/hooks";
import { setAuthUser } from "@/app/store/slices/authSlice";
import { apiLogin, apiSignup } from "@/domains/auth/authApi";
import { Spinner } from "@/components/Spinner";

type Mode = "login" | "signup";

export function AuthPortal() {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firmName, setFirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === "login"
          ? await apiLogin({ email, password })
          : await apiSignup({ email, password, firmName: firmName.trim() || undefined });
      dispatch(setAuthUser(user));
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

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
        p: 2,
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
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: "100%",
          maxWidth: 420,
          zIndex: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "hsl(224 45% 10% / 0.6)",
          backdropFilter: "blur(16px)",
          borderRadius: 4,
          p: { xs: 3, sm: 4 },
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Box
            sx={{
              background: "linear-gradient(135deg, hsl(43 74% 49% / 0.2), hsl(43 74% 49% / 0.05))",
              p: 1.75,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "hsl(43 74% 49% / 0.2)",
              boxShadow: "0 0 20px hsl(43 74% 49% / 0.15)",
            }}
          >
            <Scale style={{ color: "hsl(43 74% 49%)" }} className="w-7 h-7" />
          </Box>
          <Typography component="h1" sx={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>
            قانوني AI
          </Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", textAlign: "center" }}>
            {mode === "login" ? "سجّل الدخول للوصول إلى منصة العقود" : "أنشئ حساباً لبدء توليد العقود"}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 0.5, gap: 0.5 }}>
          {(["login", "signup"] as const).map((m) => {
            const active = mode === m;
            return (
              <Box
                key={m}
                component="button"
                type="button"
                onClick={() => switchMode(m)}
                sx={{
                  flex: 1,
                  py: 1,
                  borderRadius: 1.5,
                  border: "none",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all .2s",
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active ? "hsl(43 96% 56% / 0.12)" : "transparent",
                }}
              >
                {m === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
              </Box>
            );
          })}
        </Box>

        {error && <Alert severity="error" sx={{ fontSize: 13 }}>{error}</Alert>}

        <TextField
          label="البريد الإلكتروني"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          autoComplete="email"
        />
        <TextField
          label="كلمة المرور"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "signup" && (
          <TextField
            label="اسم المكتب (اختياري)"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            fullWidth
          />
        )}

        <Button type="submit" disabled={loading} fullWidth sx={{ height: 48, fontSize: 16 }}>
          {loading ? (
            <>
              <Spinner size={20} />
              <Box component="span" sx={{ ml: 1.5 }}>جاري المعالجة...</Box>
            </>
          ) : mode === "login" ? (
            "تسجيل الدخول"
          ) : (
            "إنشاء حساب"
          )}
        </Button>
      </Box>
    </Box>
  );
}
