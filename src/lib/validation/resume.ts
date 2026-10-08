import { z } from "zod";
import { optionalEnum, optionalNumber, optionalText } from "@/lib/validation/common";
import { EDUCATION_VALUES } from "@/lib/validation/job";

const month = z.string().regex(/^\d{4}-\d{2}$/, "Informe mês e ano");
const optionalMonth = z.preprocess((value) => (value === "" ? null : value), month.nullable().default(null));

const jsonArray = <T extends z.ZodType>(item: T, max: number, message: string) =>
  z.preprocess((value) => {
    if (typeof value !== "string" || value === "") return [];
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, z.array(item).max(max, message));

const experienceSchema = z
  .object({
    company_name: z.string().trim().min(2, "Informe a empresa").max(120),
    role_title: z.string().trim().min(2, "Informe o cargo").max(120),
    started_on: month,
    ended_on: optionalMonth,
    is_current: z.boolean().default(false),
    activities: z.string().trim().max(3000).default(""),
  })
  .superRefine((item, ctx) => {
    if (!item.is_current && !item.ended_on) {
      ctx.addIssue({ code: "custom", path: ["ended_on"], message: "Informe a saída ou marque como emprego atual" });
    }
    if (!item.is_current && item.ended_on && item.ended_on < item.started_on) {
      ctx.addIssue({ code: "custom", path: ["ended_on"], message: "A saída deve ser depois da entrada" });
    }
  });

const educationSchema = z.object({
  course: z.string().trim().min(2, "Informe o curso").max(160),
  institution: z.string().trim().min(2, "Informe a instituição").max(160),
  level: z.enum(EDUCATION_VALUES, { error: "Escolha o nível" }),
  is_course: z.boolean().default(false),
  started_on: optionalMonth,
  ended_on: optionalMonth,
  is_current: z.boolean().default(false),
});

export const resumeSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo").max(120),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((digits) => digits.length >= 10 && digits.length <= 11, "Informe DDD e número"),
  cityId: z.coerce.number({ error: "Escolha sua cidade na lista" }).int().positive("Escolha sua cidade na lista"),
  headline: optionalText(120),
  objective: optionalText(2000),
  areaId: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable().default(null)),
  educationLevel: optionalEnum(EDUCATION_VALUES),
  desiredSalary: optionalNumber(z.number({ error: "Valor inválido" }).min(0).max(1_000_000)),
  searchRadiusKm: z.coerce.number().int().min(0).max(1000).default(30),
  languages: jsonArray(
    z.object({
      language: z.string().trim().min(2, "Informe o idioma").max(40),
      level: z.enum(["basic", "intermediate", "advanced", "fluent"]),
    }),
    10,
    "Liste no máximo 10 idiomas",
  ),
  experiences: jsonArray(experienceSchema, 20, "Liste no máximo 20 experiências"),
  education: jsonArray(educationSchema, 20, "Liste no máximo 20 formações e cursos"),
  skills: jsonArray(
    z.object({ skill_id: z.uuid(), level: z.enum(["basic", "intermediate", "advanced"]) }),
    30,
    "Selecione no máximo 30 habilidades",
  ),
});

export type ResumeInput = z.infer<typeof resumeSchema>;

const toDate = (value: string | null) => (value ? `${value}-01` : null);

// Formato esperado pela função save_resume() do banco.
export function toSaveResumeArgs(input: ResumeInput) {
  return {
    personal: { full_name: input.fullName, phone: input.phone, city_id: input.cityId },
    resume: {
      headline: input.headline,
      objective: input.objective,
      area_id: input.areaId,
      education_level: input.educationLevel,
      desired_salary: input.desiredSalary,
      search_radius_km: input.searchRadiusKm,
      languages: input.languages,
    },
    experiences: input.experiences.map((e) => ({
      ...e,
      started_on: toDate(e.started_on),
      ended_on: e.is_current ? null : toDate(e.ended_on),
    })),
    education: input.education.map((e) => ({
      ...e,
      started_on: toDate(e.started_on),
      ended_on: e.is_current ? null : toDate(e.ended_on),
    })),
    skills: input.skills,
  };
}

export const RESUME_PDF_MAX_BYTES = 5 * 1024 * 1024;
