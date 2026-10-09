import { z } from "zod";
import { todayInBrazil } from "@/lib/format";
import { optionalEnum, optionalNumber } from "@/lib/validation/common";

export const CONTRACT_VALUES = ["clt", "pj", "internship", "temporary"] as const;
export const WORK_MODE_VALUES = ["on_site", "hybrid", "remote"] as const;
export const EDUCATION_VALUES = [
  "elementary",
  "high_school",
  "technical",
  "undergraduate",
  "postgraduate",
  "masters",
  "doctorate",
] as const;
export const QUESTION_TYPE_VALUES = ["yes_no", "short_text", "single_choice"] as const;

const skillSchema = z.object({
  skill_id: z.uuid(),
  requirement: z.enum(["required", "desired"]),
});

const questionSchema = z
  .object({
    id: z.uuid().optional(),
    question: z.string().trim().min(3, "Escreva a pergunta").max(300),
    type: z.enum(QUESTION_TYPE_VALUES),
    options: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
    is_required: z.boolean().default(true),
  })
  .refine((q) => q.type !== "single_choice" || q.options.length >= 2, {
    message: "Informe ao menos duas opções",
    path: ["options"],
  });

const jsonArray = <T extends z.ZodType>(item: T, max: number, message: string) =>
  z.preprocess((value) => {
    if (typeof value !== "string" || value === "") return [];
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, z.array(item).max(max, message));

export const jobSchema = z
  .object({
    intent: z.enum(["draft", "submit"]).default("draft"),
    title: z.string().trim().min(3, "Informe o título da vaga").max(120),
    description: z.string().trim().min(30, "Descreva a vaga com ao menos 30 caracteres").max(20000),
    areaId: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable().default(null)),
    contractType: z.enum(CONTRACT_VALUES, { error: "Escolha o tipo de contrato" }),
    workMode: z.enum(WORK_MODE_VALUES, { error: "Escolha a modalidade" }),
    cityId: optionalNumber(z.number().int().positive()),
    salaryMin: optionalNumber(z.number({ error: "Valor inválido" }).min(0).max(1_000_000)),
    salaryMax: optionalNumber(z.number({ error: "Valor inválido" }).min(0).max(1_000_000)),
    benefits: z.preprocess(
      (value) =>
        typeof value === "string"
          ? value
              .split(/\n|;/)
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      z.array(z.string().max(80, "Cada benefício pode ter até 80 caracteres")).max(20, "Liste no máximo 20 benefícios"),
    ),
    positions: z.coerce.number().int().min(1, "Mínimo de 1 vaga").max(1000),
    closesAt: z.preprocess(
      (value) => (value === "" ? null : value),
      z.iso.date({ error: "Data inválida" }).nullable().default(null),
    ),
    regionMode: z.enum(["prioritize", "restrict"]),
    radiusKm: z.coerce.number().int().min(0).max(1000, "Raio máximo de 1000 km"),
    minEducation: optionalEnum(EDUCATION_VALUES),
    minExperienceYears: optionalNumber(z.number().min(0).max(50)),
    affirmative: optionalEnum(["pcd", "women", "black_people", "indigenous", "lgbtqia", "people_50_plus"] as const),
    isConfidential: z.preprocess((value) => value === "on" || value === true, z.boolean()).default(false),
    skills: jsonArray(skillSchema, 30, "Selecione no máximo 30 habilidades"),
    questions: jsonArray(questionSchema, 10, "Use no máximo 10 perguntas"),
  })
  .superRefine((job, ctx) => {
    if (job.workMode !== "remote" && !job.cityId) {
      ctx.addIssue({ code: "custom", path: ["cityId"], message: "Vaga presencial ou híbrida precisa de cidade" });
    }
    if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) {
      ctx.addIssue({ code: "custom", path: ["salaryMax"], message: "O máximo deve ser maior que o mínimo" });
    }
    if (job.closesAt && job.closesAt < todayInBrazil()) {
      ctx.addIssue({ code: "custom", path: ["closesAt"], message: "A data de encerramento já passou" });
    }
  });

export type JobInput = z.infer<typeof jobSchema>;

// Formato esperado pela função save_job() do banco.
export function toSaveJobPayload(job: JobInput) {
  return {
    title: job.title,
    description: job.description,
    area_id: job.areaId,
    contract_type: job.contractType,
    work_mode: job.workMode,
    city_id: job.workMode === "remote" ? null : job.cityId,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    benefits: job.benefits,
    positions: job.positions,
    closes_at: job.closesAt,
    region_mode: job.regionMode,
    radius_km: job.radiusKm,
    min_education: job.minEducation,
    min_experience_months: job.minExperienceYears == null ? null : Math.round(job.minExperienceYears * 12),
    affirmative: job.affirmative,
    is_confidential: job.isConfidential,
  };
}
