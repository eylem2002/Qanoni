import type { ReactNode } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { FieldLabel } from "./FieldLabel";

export interface SelectOption {
  value: string;
  label: ReactNode;
}

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  required?: boolean;
  placeholder?: string;
  options: SelectOption[];
};

export function RHFSelect<T extends FieldValues>({
  control,
  name,
  label,
  required,
  placeholder = "اختر...",
  options,
}: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormControl fullWidth size="small" error={!!fieldState.error}>
          {label && <FieldLabel label={label} required={required} />}
          <Select
            displayEmpty
            value={field.value == null ? "" : String(field.value)}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            renderValue={(selected) => {
              const v = (selected as string) ?? "";
              if (!v) {
                return <Box component="span" sx={{ color: "text.secondary" }}>{placeholder}</Box>;
              }
              const opt = options.find((o) => String(o.value) === v);
              return opt ? opt.label : v;
            }}
          >
            {options.map((o) => (
              <MenuItem key={String(o.value)} value={String(o.value)}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
          {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
        </FormControl>
      )}
    />
  );
}
