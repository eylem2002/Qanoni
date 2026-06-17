import { useEffect, type ReactNode } from "react";
import Box from "@mui/material/Box";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { setAuthUser, setUnauthenticated } from "@/app/store/slices/authSlice";
import { apiMe } from "@/domains/auth/authApi";
import { AuthPortal } from "@/portals/auth/AuthPortal";
import { Spinner } from "@/components/Spinner";

export function AuthGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);

  useEffect(() => {
    let active = true;
    apiMe()
      .then((user) => {
        if (!active) return;
        dispatch(user ? setAuthUser(user) : setUnauthenticated());
      })
      .catch(() => {
        if (active) dispatch(setUnauthenticated());
      });
    return () => {
      active = false;
    };
  }, [dispatch]);

  if (status === "loading") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Spinner size={40} />
      </Box>
    );
  }

  if (status === "unauthenticated") return <AuthPortal />;

  return <>{children}</>;
}
