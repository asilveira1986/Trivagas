import "server-only";
import { cache } from "react";
import { getCurrentProfile } from "@/lib/auth";
import type { EducationLevel, LanguageLevel, SkillLevel, TalentPoolStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export type ResumeDetail = {
  id: string;
  profile_id: string;
  headline: string | null;
  objective: string | null;
  city_id: number | null;
  area_id: string | null;
  education_level: EducationLevel | null;
  desired_salary: number | null;
  languages: { language: string; level: LanguageLevel }[];
  pdf_path: string | null;
  search_radius_km: number;
  talent_pool_status: TalentPoolStatus;
  updated_at: string;
  cities: { name: string; states: { uf: string } | null } | null;
  areas: { name: string } | null;
  resume_experiences: {
    id: string;
    company_name: string;
    role_title: string;
    started_on: string;
    ended_on: string | null;
    is_current: boolean;
    activities: string | null;
  }[];
  resume_education: {
    id: string;
    course: string;
    institution: string;
    level: EducationLevel;
    is_course: boolean;
    started_on: string | null;
    ended_on: string | null;
    is_current: boolean;
  }[];
  resume_skills: { level: SkillLevel; skills: { id: string; name: string } | null }[];
};

export const RESUME_COLUMNS = `
  id, profile_id, headline, objective, city_id, area_id, education_level, desired_salary, languages, pdf_path,
  search_radius_km, talent_pool_status, updated_at,
  cities(name, states(uf)),
  areas(name),
  resume_experiences(id, company_name, role_title, started_on, ended_on, is_current, activities),
  resume_education(id, course, institution, level, is_course, started_on, ended_on, is_current),
  resume_skills(level, skills(id, name))
`;

// Mais recentes primeiro; emprego atual no topo.
export function sortResume<T extends ResumeDetail | null>(resume: T): T {
  if (!resume) return resume;
  resume.resume_experiences.sort((a, b) => Number(b.is_current) - Number(a.is_current) || b.started_on.localeCompare(a.started_on));
  resume.resume_education.sort(
    (a, b) => Number(b.is_current) - Number(a.is_current) || (b.ended_on ?? b.started_on ?? "").localeCompare(a.ended_on ?? a.started_on ?? ""),
  );
  return resume;
}

export const getMyResume = cache(async () => {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("resumes").select(RESUME_COLUMNS).eq("profile_id", profile.id).maybeSingle<ResumeDetail>();
  return sortResume(data);
});

// Itens que tornam o currículo atrativo para as empresas.
export function resumeChecklist(resume: ResumeDetail | null) {
  return [
    { label: "Título profissional", done: Boolean(resume?.headline) },
    { label: "Objetivo", done: Boolean(resume?.objective) },
    { label: "Experiência ou formação", done: Boolean(resume && (resume.resume_experiences.length || resume.resume_education.length)) },
    { label: "Habilidades", done: Boolean(resume?.resume_skills.length) },
    { label: "Currículo em PDF", done: Boolean(resume?.pdf_path) },
  ];
}

export async function signedResumePdfUrl(path: string | null, expiresInSeconds = 600) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("resumes").createSignedUrl(path, expiresInSeconds, { download: true });
  return data?.signedUrl ?? null;
}
