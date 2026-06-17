import type { ReactNode } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import Box from "@mui/material/Box";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: ReactNode;
  description?: ReactNode | ((checked: boolean) => ReactNode);
};

export function RHFSwitch<T extends FieldValues>({ control, name, label, description }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const checked = !!field.value;
        const desc = typeof description === "function" ? description(checked) : description;
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "hsl(224 45% 8% / 0.5)",
              px: 2,
              py: 1.25,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                {label}
              </Typography>
              {desc != null && (
                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>{desc}</Typography>
              )}
            </Box>
            <Switch
              checked={checked}
              onChange={(e) => field.onChange(e.target.checked)}
              color="primary"
            />
          </Box>
        );
      }}
    />
  );
}
