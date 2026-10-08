import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => digits.length >= 10 && digits.length <= 11, "Informe DDD e número (WhatsApp)");

export const signupSchema = z.object({
  role: z.enum(["candidate", "company"]),
  fullName: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: z.email("E-mail inválido").trim().toLowerCase(),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72),
  cityId: z.coerce.number({ error: "Escolha sua cidade na lista" }).int().positive("Escolha sua cidade na lista"),
  phone: phoneSchema,
  acceptTerms: z.literal("on", { error: "É preciso aceitar os termos para continuar" }),
});

export const onboardingSchema = signupSchema.pick({ role: true, fullName: true, cityId: true, phone: true, acceptTerms: true });

export type { FieldErrors } from "@/lib/validation/common";
