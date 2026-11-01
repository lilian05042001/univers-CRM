import { z } from "zod"

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "validation.email" }))

// Aceleași reguli ca în supabase/config.toml (minimum 8, litere + cifre).
export const passwordSchema = z
  .string()
  .min(8, { error: "validation.passwordMin" })
  .max(72, { error: "validation.passwordMax" })
  .regex(/[a-zA-Z]/, { error: "validation.passwordLetters" })
  .regex(/\d/, { error: "validation.passwordDigits" })

const nextSchema = z.string().optional()

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "validation.required" }),
  next: nextSchema,
})

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "validation.nameMin" })
    .max(120, { error: "validation.tooLong" }),
  email: emailSchema,
  password: passwordSchema,
  next: nextSchema,
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: "validation.passwordMismatch",
    path: ["confirmPassword"],
  })

export type LoginInput = z.input<typeof loginSchema>
export type RegisterInput = z.input<typeof registerSchema>
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
