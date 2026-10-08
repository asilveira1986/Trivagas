import { z } from "zod";

export type FieldErrors = Partial<Record<string, string[]>>;

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

// Texto opcional: vazio vira null.
export const optionalText = (max: number, message = `Use no máximo ${max} caracteres`) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : typeof value === "string" ? value.trim() : value),
    z.string().max(max, message).nullable().default(null),
  );

export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === "" ? null : value), z.enum(values).nullable().default(null));

export const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : typeof value === "string" ? Number(value.replace(",", ".")) : value),
    schema.nullable().default(null),
  );
