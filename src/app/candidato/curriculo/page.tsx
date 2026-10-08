import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/area-shell";
import { PdfUpload } from "@/components/resume/pdf-upload";
import { requireRole } from "@/lib/auth";
import { getJobCatalogs } from "@/lib/catalogs";
import { cityLabel } from "@/lib/company";
import { formatPhone } from "@/lib/format";
import { getMyResume, signedResumePdfUrl } from "@/lib/resume";
import { createClient } from "@/lib/supabase/server";
import { ResumeForm } from "./resume-form";

export const metadata: Metadata = { title: "Meu currículo" };

const toMonth = (value: string | null) => (value ? value.slice(0, 7) : "");

export default async function ResumePage() {
  const profile = await requireRole("candidate");
  const supabase = await createClient();
  const [resume, catalogs, { data: city }] = await Promise.all([
    getMyResume(),
    getJobCatalogs(),
    profile.city_id
      ? supabase.from("cities").select("name, states(uf)").eq("id", profile.city_id).maybeSingle<{ name: string; states: { uf: string } | null }>()
      : Promise.resolve({ data: null }),
  ]);
  const pdfUrl = await signedResumePdfUrl(resume?.pdf_path ?? null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu currículo" description="Preencha uma vez e use em todas as candidaturas." />

      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="font-extrabold">Currículo em PDF</h2>
        <PdfUpload userId={profile.id} downloadUrl={pdfUrl} />
      </section>

      <ResumeForm
        {...catalogs}
        values={{
          fullName: profile.full_name,
          phone: formatPhone(profile.phone),
          city: profile.city_id && city ? { id: profile.city_id, label: cityLabel(city) ?? "" } : null,
          headline: resume?.headline ?? "",
          objective: resume?.objective ?? "",
          areaId: resume?.area_id ?? "",
          educationLevel: resume?.education_level ?? "",
          desiredSalary: resume?.desired_salary?.toString() ?? "",
          searchRadiusKm: String(resume?.search_radius_km ?? 30),
          experiences: (resume?.resume_experiences ?? []).map((e) => ({
            key: e.id,
            company_name: e.company_name,
            role_title: e.role_title,
            started_on: toMonth(e.started_on),
            ended_on: toMonth(e.ended_on),
            is_current: e.is_current,
            activities: e.activities ?? "",
          })),
          education: (resume?.resume_education ?? []).map((e) => ({
            key: e.id,
            course: e.course,
            institution: e.institution,
            level: e.level,
            is_course: e.is_course,
            started_on: toMonth(e.started_on),
            ended_on: toMonth(e.ended_on),
            is_current: e.is_current,
          })),
          languages: (resume?.languages ?? []).map((l) => ({ key: `${l.language}-${l.level}`, ...l })),
          skills: (resume?.resume_skills ?? []).filter((s) => s.skills).map((s) => ({ skill_id: s.skills!.id, tag: s.level })),
        }}
      />
    </div>
  );
}
