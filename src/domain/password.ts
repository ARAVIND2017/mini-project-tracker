import { z } from 'zod';

/** Mirrors the Supabase Auth policy: at least 10 characters, with letters and digits. */
export const passwordSchema = z
  .string()
  .min(10, 'At least 10 characters')
  .max(72, 'At most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one digit');

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
