import "server-only";
import type { EducationLevel, InviteStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export type TalentResult = {
  resume_id: string;
  display_name: string;
  headline: string | null;
  city_name: string | null;
  uf: string | null;
  area_name: string | null;
  education_level: EducationLevel | null;
  experience_months: number;
  distance_km: number | null;
  band: number;
  score: number | null;
  matched_required: number;
  total_required: number;
  matched_desired: number;
  total_desired: number;
  area_match: boolean | null;
  education_match: boolean | null;
  experience_match: boolean | null;
  matched_skills: string[];
  updated_at: string;
  already_applied: boolean;
  invite_status: InviteStatus | null;
  saved: boolean;
  total_count: number;
};

export type TalentFilters = {
  jobId: string | null;
  cityId: number | null;
  radiusKm: number | null;
  areaId: string | null;
  skillIds: string[];
  minEducation: EducationLevel | null;
  minExperienceYears: number | null;
  query: string | null;
  page: number;
};

export const PAGE_SIZE = 20;
const UUID = /^[0-9a-f-]{36}$/i;
const EDUCATION = ["elementary", "high_school", "technical", "undergraduate", "postgraduate", "masters", "doctorate"];

// Lê os filtros da URL (?vaga=&cidade=&raio=&area=&habilidades=&escolaridade=&experiencia=&q=&pagina=).
export function parseTalentFilters(params: Record<string, string | string[] | undefined>): TalentFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim() : "");
  const int = (key: string, max: number) => {
    const value = Number.parseInt(one(key), 10);
    return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
  };
  return {
    jobId: UUID.test(one("vaga")) ? one("vaga") : null,
    cityId: int("cidade", 9_999_999),
    radiusKm: int("raio", 1000),
    areaId: UUID.test(one("area")) ? one("area") : null,
    skillIds: one("habilidades").split(",").filter((id) => UUID.test(id)).slice(0, 10),
    minEducation: EDUCATION.includes(one("escolaridade")) ? (one("escolaridade") as EducationLevel) : null,
    minExperienceYears: int("experiencia", 50),
    query: one("q").slice(0, 100) || null,
    page: Math.max(1, int("pagina", 500) ?? 1),
  };
}

export async function searchTalent(filters: TalentFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("talent_search", {
    target_job: filters.jobId,
    center_city: filters.cityId,
    radius_km: filters.radiusKm,
    area: filters.areaId,
    skill_ids: filters.skillIds.length ? filters.skillIds : null,
    min_education: filters.minEducation,
    min_experience_months: filters.minExperienceYears == null ? null : filters.minExperienceYears * 12,
    query: filters.query,
    page_size: PAGE_SIZE,
    page_offset: (filters.page - 1) * PAGE_SIZE,
  });
  return { results: (data ?? []) as TalentResult[], error };
}

// Rótulo da faixa de proximidade, como a empresa vê.
export function proximityLabel(result: Pick<TalentResult, "band" | "distance_km">, radiusKm: number) {
  const km = result.distance_km != null ? ` · ${Math.round(result.distance_km)} km` : "";
  switch (result.band) {
    case 1:
      return "Mesma cidade";
    case 2:
      return `Até ${radiusKm} km${km}`;
    case 3:
      return `Mesmo estado${km}`;
    case 4:
      return `Outro estado${km}`;
    case 5:
      return "Cidade não informada";
    default:
      return null;
  }
}

export async function getTalentIdentity(resumeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("talent_identity", { target_resume: resumeId })
    .maybeSingle<{ display_name: string; contact_released: boolean; application_id: string | null }>();
  return data;
}
