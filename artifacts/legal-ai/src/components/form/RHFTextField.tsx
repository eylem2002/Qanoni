import type { ReactNode } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import Box from "@mui/material/Box";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { FieldLabel } from "./FieldLabel";

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  helpText?: ReactNode;
} & Omit<TextFieldProps, "name" | "label" | "required" | "error" | "helperText">;

export function RHFTextField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  helpText,
  ...rest
}: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const { value, ...fieldRest } = field;
        return (
          <Box>
            {label && <FieldLabel label={label} required={required} hint={hint} />}
            <TextField
              {...fieldRest}
              value={value ?? ""}
              size="small"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? helpText}
              {...rest}
            />
          </Box>
        );
      }}
    />
  );
}
