import CircularProgress, { type CircularProgressProps } from "@mui/material/CircularProgress";

export function Spinner({ size = 16, ...rest }: { size?: number } & Omit<CircularProgressProps, "size">) {
  return <CircularProgress size={size} thickness={5} color="inherit" {...rest} />;
}
