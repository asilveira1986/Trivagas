import type { Metadata } from "next";
import { JobForm } from "@/components/jobs/job-form";
import { PageHeader } from "@/components/layout/area-shell";
import { Alert } from "@/components/ui/alert";
import { getJobCatalogs } from "@/lib/catalogs";
import { cityLabel, requireMembership } from "@/lib/company";
import { todayInBrazil } from "@/lib/format";
import { saveJob } from "../actions";

export const metadata: Metadata = { title: "Nova vaga" };

export default async function NewJobPage() {
  const [{ company }, catalogs] = await Promise.all([requireMembership(), getJobCatalogs()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nova vaga" description="Toda vaga passa por análise da nossa equipe antes de ser publicada." />
      {company.status !== "approved" && (
        <Alert>
          Sua empresa ainda não foi aprovada. Você pode preparar e enviar a vaga; ela será publicada após a aprovação do
          cadastro.
        </Alert>
      )}
      <JobForm
        action={saveJob.bind(null, null)}
        status={null}
        minDate={todayInBrazil()}
        {...catalogs}
        values={{
          title: "",
          description: "",
          areaId: "",
          contractType: "clt",
          workMode: "on_site",
          city: company.city_id ? { id: company.city_id, label: cityLabel(company.cities) ?? "" } : null,
          salaryMin: "",
          salaryMax: "",
          benefits: "",
          positions: "1",
          closesAt: "",
          regionMode: "prioritize",
          radiusKm: "30",
          minEducation: "",
          minExperienceYears: "",
          affirmative: "",
          isConfidential: false,
          skills: [],
          questions: [],
        }}
      />
    </div>
  );
}
