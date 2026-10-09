import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { JobStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { JobStatus } from "@/lib/labels";
import { jobPath } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ReportActions } from "./report-actions";

export const metadata: Metadata = { title: "Denúncias" };

type Row = {
  id: string;
  job_id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  jobs: { title: string; slug: string; status: JobStatus; companies: { id: string; trade_name: string } | null } | null;
};

const STATUS = { open: "Abertas", reviewing: "Em análise", resolved: "Resolvidas", dismissed: "Arquivadas" } as const;

export default async function ReportsPage({ searchParams }: PageProps<"/admin/denuncias">) {
  const { status } = await searchParams;
  const filter = (Object.keys(STATUS) as (keyof typeof STATUS)[]).find((s) => s === status) ?? "open";
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_reports")
    .select("id, job_id, reason, details, status, created_at, resolved_at, jobs(title, slug, status, companies(id, trade_name))")
    .eq("status", filter)
    .order("created_at", { ascending: filter === "open" })
    .limit(100)
    .overrideTypes<Row[], { merge: false }>();
  const reports = data ?? [];
  const perJob = new Map<string, number>();
  for (const report of reports) perJob.set(report.job_id, (perJob.get(report.job_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Denúncias de vagas" description="Denúncias de visitantes e candidatos. Golpes comuns: cobrança de taxa e pedido de dados sensíveis." />
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.entries(STATUS) as [keyof typeof STATUS, string][]).map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/denuncias?status=${value}`}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold",
              filter === value ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Nenhuma denúncia aqui.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <li key={report.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-extrabold">{report.reason}</span>
                  <span className="text-sm text-muted-foreground">
                    {report.jobs?.status === "published" ? (
                      <Link href={jobPath(report.jobs.slug)} target="_blank" className="font-semibold text-primary hover:underline">
                        {report.jobs.title}
                      </Link>
                    ) : (
                      report.jobs?.title
                    )}{" "}
                    ·{" "}
                    {report.jobs?.companies && (
                      <Link href={`/admin/empresas/${report.jobs.companies.id}`} className="hover:underline">
                        {report.jobs.companies.trade_name}
                      </Link>
                    )}{" "}
                    · {formatDateTime(report.created_at)}
                  </span>
                </div>
                <span className="flex items-center gap-2">
                  {(perJob.get(report.job_id) ?? 0) > 1 && <Badge variant="danger">{perJob.get(report.job_id)} denúncias</Badge>}
                  {report.jobs && <JobStatusBadge status={report.jobs.status} />}
                </span>
              </div>
              {report.details && <p className="whitespace-pre-line text-sm">{report.details}</p>}
              {(report.status === "open" || report.status === "reviewing") && (
                <ReportActions reportId={report.id} jobId={report.job_id} jobPublished={report.jobs?.status === "published"} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
