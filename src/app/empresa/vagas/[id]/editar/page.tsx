import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobForm } from "@/components/jobs/job-form";
import { PageHeader } from "@/components/layout/area-shell";
import { Alert } from "@/components/ui/alert";
import { getJobCatalogs } from "@/lib/catalogs";
import { requireMembership } from "@/lib/company";
import { todayInBrazil } from "@/lib/format";
import { getJobForUser } from "@/lib/jobs";
import { saveJob } from "../../actions";

export const metadata: Metadata = { title: "Editar vaga" };

export default async function EditJobPage({ params, searchParams }: PageProps<"/empresa/vagas/[id]/editar">) {
  const [{ id }, { copia }] = await Promise.all([params, searchParams]);
  const [{ company }, job, catalogs] = await Promise.all([requireMembership(), getJobForUser(id), getJobCatalogs()]);
  if (!job || job.company_id !== company.id) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Editar vaga" description={job.title} />
      {copia && <Alert variant="success">Vaga duplicada como rascunho. Revise os dados e envie para análise.</Alert>}
      <JobForm
        action={saveJob.bind(null, job.id)}
        status={job.status}
        minDate={todayInBrazil()}
        {...catalogs}
        values={{
          title: job.title,
          description: job.description,
          areaId: job.area_id ?? "",
          contractType: job.contract_type,
          workMode: job.work_mode,
          city: job.city_id && job.cities ? { id: job.city_id, label: `${job.cities.name} - ${job.cities.states?.uf}` } : null,
          salaryMin: job.salary_min?.toString() ?? "",
          salaryMax: job.salary_max?.toString() ?? "",
          benefits: job.benefits.join("\n"),
          positions: String(job.positions),
          closesAt: job.closes_at ?? "",
          regionMode: job.region_mode,
          radiusKm: String(job.radius_km),
          minEducation: job.min_education ?? "",
          minExperienceYears: job.min_experience_months ? String(Math.round((job.min_experience_months / 12) * 10) / 10) : "",
          skills: job.job_skills
            .filter((s) => s.skills)
            .map((s) => ({ skill_id: s.skills!.id, requirement: s.requirement })),
          questions: job.job_questions.map((q) => ({
            key: q.id,
            id: q.id,
            question: q.question,
            type: q.type,
            options: q.options,
            is_required: q.is_required,
          })),
        }}
      />
    </div>
  );
}
