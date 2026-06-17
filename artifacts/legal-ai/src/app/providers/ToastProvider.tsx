import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

export type ToastVariant = "default" | "destructive";

export interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
}

export type ToastFn = (opts: ToastOptions) => void;

interface ToastState extends ToastOptions {
  key: number;
  open: boolean;
}

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({ key: 0, open: false });

  const toast = useCallback<ToastFn>((opts) => {
    setState({ ...opts, key: Date.now(), open: true });
  }, []);

  const handleClose = (_event?: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    setState((s) => ({ ...s, open: false }));
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Snackbar
        key={state.key}
        open={state.open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleClose}
          severity={state.variant === "destructive" ? "error" : "success"}
          variant="filled"
          sx={{ maxWidth: 440, boxShadow: 6, alignItems: "flex-start" }}
        >
          {state.title != null && (
            <AlertTitle sx={{ fontWeight: 700, mb: state.description != null ? 0.5 : 0 }}>
              {state.title}
            </AlertTitle>
          )}
          {state.description}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): { toast: ToastFn } {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used within ToastProvider");
  return { toast };
}
