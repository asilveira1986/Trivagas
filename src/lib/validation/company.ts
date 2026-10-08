import { z } from "zod";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import { optionalEnum, optionalText } from "@/lib/validation/common";

export const COMPANY_SIZE_VALUES = ["mei", "micro", "small", "medium", "large"] as const;

export const companySchema = z.object({
  cnpj: z
    .string()
    .transform(normalizeCnpj)
    .refine(isValidCnpj, "CNPJ inválido: confira os números"),
  legalName: z.string().trim().min(2, "Informe a razão social").max(200),
  tradeName: z.string().trim().min(2, "Informe o nome fantasia").max(120),
  segment: optionalText(80),
  size: optionalEnum(COMPANY_SIZE_VALUES),
  postalCode: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") || null : null),
    z.string().length(8, "CEP deve ter 8 números").nullable(),
  ),
  street: optionalText(160),
  streetNumber: optionalText(20),
  complement: optionalText(80),
  district: optionalText(80),
  cityId: z.coerce.number({ error: "Escolha a cidade na lista" }).int().positive("Escolha a cidade na lista"),
  phone: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") || null : null),
    z.string().regex(/^\d{10,11}$/, "Informe DDD e número").nullable(),
  ),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null),
    z.email("E-mail inválido").nullable(),
  ),
  website: z.preprocess(
    (value) => {
      if (typeof value !== "string" || !value.trim()) return null;
      const url = value.trim();
      return /^https?:\/\//i.test(url) ? url : `https://${url}`;
    },
    z.url({ protocol: /^https?$/, error: "Endereço do site inválido" }).max(200).nullable(),
  ),
  description: optionalText(5000),
});

export type CompanyInput = z.infer<typeof companySchema>;

export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 1024 * 1024;
