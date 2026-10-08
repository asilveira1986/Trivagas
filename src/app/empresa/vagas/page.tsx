import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Plus, UsersRound } from "lucide-react";
import { JobActions } from "@/components/jobs/job-actions";
import { PageHeader } from "@/components/layout/area-shell";
import { JobStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { locationLabel } from "@/lib/jobs";
import { JOB_STATUSES, type JobStatus, type WorkMode } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vagas" };

type JobRow = {
  id: string;
  slug: string;
  title: string;
  status: JobStatus;
  work_mode: WorkMode;
  closes_at: string | null;
  updated_at: string;
  cities: { name: string; states: { uf: string } | null } | null;
  applications: { count: number }[];
};

const FILTERS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  ...(Object.entries(JOB_STATUSES) as [JobStatus, string][]).map(([value, label]) => ({ value, label })),
];

export default async function JobsPage({ searchParams }: PageProps<"/empresa/vagas">) {
  const { company } = await requireMembership();
  const { status, erro } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? (status as JobStatus) : "all";

  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select("id, slug, title, status, work_mode, closes_at, updated_at, cities(name, states(uf)), applications(count)")
    .eq("company_id", company.id)
    .order("updated_at", { ascending: false });
  if (filter !== "all") query = query.eq("status", filter);
  const { data } = await query.overrideTypes<JobRow[], { merge: false }>();
  const jobs = data ?? [];

  const { data: views } = jobs.length
    ? await supabase.rpc("job_view_counts", { target_jobs: jobs.map((job) => job.id) })
    : { data: [] };
  const viewTotals = new Map<string, number>();
  for (const row of (views ?? []) as { job_id: string; total: number }[]) {
    viewTotals.set(row.job_id, (viewTotals.get(row.job_id) ?? 0) + Number(row.total));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vagas"
        actions={
          <Button asChild>
            <Link href="/empresa/vagas/nova">
              <Plus /> Nova vaga
            </Link>
          </Button>
        }
      />
      {typeof erro === "string" && <Alert variant="destructive">{erro}</Alert>}

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/empresa/vagas" : `/empresa/vagas?status=${f.value}`}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold",
              filter === f.value ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-semibold">Nenhuma vaga {filter === "all" ? "cadastrada" : "nesta situação"}.</p>
          <Button asChild variant="outline">
            <Link href="/empresa/vagas/nova">Criar vaga</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <Link href={`/empresa/vagas/${job.id}`} className="text-lg font-extrabold hover:text-primary">
                    {job.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {locationLabel(job)}
                    {job.closes_at && ` · até ${formatDate(job.closes_at)}`}
                  </p>
                </div>
                <JobStatusBadge status={job.status} />
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="size-4" /> {viewTotals.get(job.id) ?? 0} visualizações
                </span>
                <Link href={`/empresa/candidatos?vaga=${job.id}`} className="flex items-center gap-1 hover:text-primary">
                  <UsersRound className="size-4" /> {job.applications[0]?.count ?? 0} candidaturas
                </Link>
              </div>
              <JobActions job={job} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
