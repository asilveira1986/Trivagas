import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { RatingStars } from "@/components/rating-stars";
import { StageBadge } from "@/components/status-stage";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cityLabel, requireMembership } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { APPLICATION_STAGES, VIEW_SOURCES, type ApplicationStage, type ApplicationSource } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Candidatos" };

type Row = {
  id: string;
  stage: ApplicationStage;
  rating: number | null;
  source: ApplicationSource;
  source_detail: string | null;
  created_at: string;
  jobs: { id: string; title: string } | null;
  resumes: {
    headline: string | null;
    cities: { name: string; states: { uf: string } | null } | null;
    profiles: { full_name: string } | null;
  } | null;
};

const STAGES = Object.keys(APPLICATION_STAGES) as ApplicationStage[];

export default async function ApplicantsPage({ searchParams }: PageProps<"/empresa/candidatos">) {
  const { company } = await requireMembership();
  const { vaga, etapa } = await searchParams;
  const jobFilter = typeof vaga === "string" && /^[0-9a-f-]{36}$/i.test(vaga) ? vaga : null;
  const stageFilter = STAGES.includes(etapa as ApplicationStage) ? (etapa as ApplicationStage) : null;

  const supabase = await createClient();
  let countsQuery = supabase.from("applications").select("stage, jobs!inner(company_id)").eq("jobs.company_id", company.id);
  let listQuery = supabase
    .from("applications")
    .select(
      "id, stage, rating, source, source_detail, created_at, jobs!inner(id, title, company_id), resumes(headline, cities(name, states(uf)), profiles(full_name))",
    )
    .eq("jobs.company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (jobFilter) {
    countsQuery = countsQuery.eq("job_id", jobFilter);
    listQuery = listQuery.eq("job_id", jobFilter);
  }
  if (stageFilter) listQuery = listQuery.eq("stage", stageFilter);

  const [{ data: stageRows }, { data }, { data: jobs }] = await Promise.all([
    countsQuery.overrideTypes<{ stage: ApplicationStage }[], { merge: false }>(),
    listQuery.overrideTypes<Row[], { merge: false }>(),
    supabase.from("jobs").select("id, title").eq("company_id", company.id).neq("status", "draft").order("updated_at", { ascending: false }),
  ]);
  const counts = new Map<ApplicationStage, number>();
  for (const row of stageRows ?? []) counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);
  const total = stageRows?.length ?? 0;
  const applications = data ?? [];
  const href = (stage: ApplicationStage | null) => {
    const params = new URLSearchParams();
    if (jobFilter) params.set("vaga", jobFilter);
    if (stage) params.set("etapa", stage);
    const query = params.toString();
    return `/empresa/candidatos${query ? `?${query}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Candidatos" description="Funil de candidaturas das vagas da empresa." />

      <form className="flex flex-col gap-2 sm:flex-row sm:items-end" action="/empresa/candidatos">
        <label className="flex flex-1 flex-col gap-2 text-sm font-semibold">
          Vaga
          <NativeSelect name="vaga" defaultValue={jobFilter ?? ""}>
            <option value="">Todas as vagas</option>
            {(jobs ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </NativeSelect>
        </label>
        {stageFilter && <input type="hidden" name="etapa" value={stageFilter} />}
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Etapas">
        {[null, ...STAGES].map((stage) => (
          <Link
            key={stage ?? "all"}
            href={href(stage)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold",
              stageFilter === stage ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary",
            )}
          >
            {stage ? APPLICATION_STAGES[stage] : "Todas"} ({stage ? (counts.get(stage) ?? 0) : total})
          </Link>
        ))}
      </nav>

      {applications.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma candidatura {stageFilter ? "nesta etapa" : "ainda"}. Divulgue o link da vaga no WhatsApp e nas redes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((application) => (
            <li key={application.id}>
              <Link
                href={`/empresa/candidatos/${application.id}`}
                className="flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-lg font-extrabold">{application.resumes?.profiles?.full_name ?? "Candidato"}</span>
                    {application.resumes?.headline && (
                      <span className="text-sm text-muted-foreground">{application.resumes.headline}</span>
                    )}
                  </div>
                  <StageBadge stage={application.stage} audience="company" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {!jobFilter && <span className="font-semibold text-foreground">{application.jobs?.title}</span>}
                  {application.resumes?.cities && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-4" /> {cityLabel(application.resumes.cities)}
                    </span>
                  )}
                  <span>
                    {formatDate(application.created_at)} ·{" "}
                    {application.source === "invite"
                      ? "convite"
                      : VIEW_SOURCES[application.source_detail ?? "direct"]?.toLowerCase() ?? "link"}
                  </span>
                  <RatingStars value={application.rating} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
