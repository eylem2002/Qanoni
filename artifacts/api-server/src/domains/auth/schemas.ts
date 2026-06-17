import { z } from "zod/v4";

export const SignupBody = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
  firmName: z.string().trim().min(1).max(200).optional(),
});

export const LoginBody = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export type SignupInput = z.infer<typeof SignupBody>;
export type LoginInput = z.infer<typeof LoginBody>;
