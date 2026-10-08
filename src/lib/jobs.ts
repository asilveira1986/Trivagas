import "server-only";
import { cache } from "react";
import type {
  CompanyStatus,
  ContractType,
  EducationLevel,
  JobStatus,
  ModerationDecision,
  QuestionType,
  RegionMode,
  WorkMode,
} from "@/lib/labels";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

type CityRef = { name: string; states: { uf: string } | null } | null;

export type JobQuestion = {
  id: string;
  position: number;
  question: string;
  type: QuestionType;
  options: string[];
  is_required: boolean;
};

export type JobDetail = {
  id: string;
  slug: string;
  company_id: string;
  title: string;
  description: string;
  status: JobStatus;
  contract_type: ContractType;
  work_mode: WorkMode;
  city_id: number | null;
  area_id: string | null;
  salary_min: number | null;
  salary_max: number | null;
  benefits: string[];
  positions: number;
  closes_at: string | null;
  region_mode: RegionMode;
  radius_km: number;
  min_education: EducationLevel | null;
  min_experience_months: number | null;
  published_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  areas: { name: string } | null;
  cities: CityRef;
  companies: {
    id: string;
    slug: string;
    trade_name: string;
    logo_path: string | null;
    status: CompanyStatus;
    description: string | null;
    cities: CityRef;
  } | null;
  job_skills: { requirement: "required" | "desired"; skills: { id: string; name: string } | null }[];
  job_questions: JobQuestion[];
};

export const JOB_DETAIL_COLUMNS = `
  id, slug, company_id, title, description, status, contract_type, work_mode, city_id, area_id,
  salary_min, salary_max, benefits, positions, closes_at, region_mode, radius_km, min_education,
  min_experience_months, published_at, submitted_at, created_at, updated_at,
  areas(name),
  cities(name, states(uf)),
  companies(id, slug, trade_name, logo_path, status, description, cities(name, states(uf))),
  job_skills(requirement, skills(id, name)),
  job_questions(id, position, question, type, options, is_required)
`;

function sortQuestions(job: JobDetail | null) {
  job?.job_questions.sort((a, b) => a.position - b.position);
  return job;
}

// Vaga vista pela empresa ou pelo admin (RLS limita ao que o usuário pode ver).
export const getJobForUser = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select(JOB_DETAIL_COLUMNS).eq("id", id).maybeSingle<JobDetail>();
  return sortQuestions(data);
});

// Vaga pública pelo endereço amigável: só aparece se estiver publicada.
export const getPublishedJob = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("jobs")
    .select(JOB_DETAIL_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<JobDetail>();
  return sortQuestions(data);
});

export type ModerationEntry = {
  id: string;
  decision: ModerationDecision;
  reason: string | null;
  created_at: string;
};

export async function getModerationHistory(jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_moderation")
    .select("id, decision, reason, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .overrideTypes<ModerationEntry[], { merge: false }>();
  return data ?? [];
}

export function locationLabel(job: Pick<JobDetail, "work_mode" | "cities">) {
  if (job.work_mode === "remote") return "Remoto (todo o Brasil)";
  return job.cities ? `${job.cities.name} - ${job.cities.states?.uf ?? ""}` : "";
}
