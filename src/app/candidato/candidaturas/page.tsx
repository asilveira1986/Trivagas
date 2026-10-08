import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { StageBadge } from "@/components/status-stage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { ApplicationStage, JobStatus } from "@/lib/labels";
import { jobPath } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { withdrawApplication } from "../actions";

export const metadata: Metadata = { title: "Minhas candidaturas" };

type Row = {
  id: string;
  stage: ApplicationStage;
  created_at: string;
  updated_at: string;
  jobs: { title: string; slug: string; status: JobStatus; companies: { trade_name: string } | null } | null;
};

export default async function MyApplicationsPage({ searchParams }: PageProps<"/candidato/candidaturas">) {
  await requireRole("candidate");
  const { nova, desistencia } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id, stage, created_at, updated_at, jobs(title, slug, status, companies(trade_name))")
    .order("created_at", { ascending: false })
    .overrideTypes<Row[], { merge: false }>();
  const applications = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Minhas candidaturas" />
      {nova && (
        <Alert variant="success">
          Candidatura enviada! Você receberá um e-mail quando a empresa atualizar o andamento.{" "}
          <Link href="/candidato/curriculo" className="font-semibold underline">
            Complete seu currículo
          </Link>{" "}
          para aumentar suas chances.
        </Alert>
      )}
      {desistencia && <Alert>Candidatura retirada.</Alert>}

      {applications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-semibold">Você ainda não se candidatou a nenhuma vaga.</p>
          <p className="text-sm text-muted-foreground">Abra o link de uma vaga e toque em “Quero me candidatar”.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((application) => {
            const job = application.jobs;
            const open = job?.status === "published";
            return (
              <li key={application.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    {job && open ? (
                      <Link href={jobPath(job.slug)} className="text-lg font-extrabold hover:text-primary">
                        {job.title}
                      </Link>
                    ) : (
                      <span className="text-lg font-extrabold">{job?.title ?? "Vaga removida"}</span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {job?.companies?.trade_name} · enviada em {formatDate(application.created_at)}
                      {!open && " · vaga encerrada"}
                    </span>
                  </div>
                  <StageBadge stage={application.stage} audience="candidate" />
                </div>
                {application.stage !== "approved" && application.stage !== "rejected" && (
                  <form action={withdrawApplication}>
                    <input type="hidden" name="applicationId" value={application.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      Desistir da candidatura
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {applications.length > 0 && (
        <Button asChild variant="outline" className="w-fit">
          <Link href="/candidato/curriculo">Atualizar meu currículo</Link>
        </Button>
      )}
    </div>
  );
}
