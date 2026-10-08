import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { CompanyStatusBadge, JobStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { locationLabel } from "@/lib/jobs";
import { MODERATION_DECISIONS, type CompanyStatus, type JobStatus, type ModerationDecision, type WorkMode } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderação de vagas" };

type Row = {
  id: string;
  title: string;
  status: JobStatus;
  work_mode: WorkMode;
  submitted_at: string | null;
  updated_at: string;
  cities: { name: string; states: { uf: string } | null } | null;
  companies: { trade_name: string; status: CompanyStatus } | null;
};

const FILTERS = [
  { value: "in_review", label: "Fila de análise" },
  { value: "published", label: "Publicadas" },
  { value: "rejected", label: "Reprovadas" },
  { value: "all", label: "Todas" },
] as const;

export default async function ModerationQueuePage({ searchParams }: PageProps<"/admin/vagas">) {
  const { status, decidida } = await searchParams;
  const filter = FILTERS.find((f) => f.value === status)?.value ?? "in_review";

  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select("id, title, status, work_mode, submitted_at, updated_at, cities(name, states(uf)), companies(trade_name, status)")
    .limit(100);
  query =
    filter === "in_review"
      ? query.eq("status", "in_review").order("submitted_at", { ascending: true })
      : filter === "all"
        ? query.neq("status", "draft").order("updated_at", { ascending: false })
        : query.eq("status", filter).order("updated_at", { ascending: false });
  const { data } = await query.overrideTypes<Row[], { merge: false }>();
  const jobs = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Moderação de vagas" description="A fila mostra primeiro as vagas que aguardam há mais tempo." />
      {typeof decidida === "string" && decidida in MODERATION_DECISIONS && (
        <Alert variant="success">Decisão registrada: {MODERATION_DECISIONS[decidida as ModerationDecision]}.</Alert>
      )}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/vagas?status=${f.value}`}
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
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Nenhuma vaga aqui.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link href={`/admin/vagas/${job.id}`} className="flex flex-col gap-1 p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-col">
                  <span className="font-extrabold">{job.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {job.companies?.trade_name} · {locationLabel(job)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {job.status === "in_review" ? `enviada ${timeAgo(job.submitted_at)}` : <JobStatusBadge status={job.status} />}
                  {job.companies && job.companies.status !== "approved" && <CompanyStatusBadge status={job.companies.status} />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
