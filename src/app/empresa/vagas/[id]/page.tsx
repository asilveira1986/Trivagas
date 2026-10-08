import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { JobActions } from "@/components/jobs/job-actions";
import { JobBody, JobFacts, JobHeader } from "@/components/jobs/job-details";
import { ShareButtons } from "@/components/jobs/share-buttons";
import { JobStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/company";
import { formatDateTime } from "@/lib/format";
import { getJobForUser, getModerationHistory } from "@/lib/jobs";
import { JOB_STATUSES, MODERATION_DECISIONS, QUESTION_TYPES, VIEW_SOURCES, type JobStatus } from "@/lib/labels";
import { jobPath, jobUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vaga" };

const SAVED_MESSAGES: Partial<Record<JobStatus, string>> = {
  draft: "Rascunho salvo.",
  in_review: "Vaga enviada para análise. Avisaremos por e-mail quando for aprovada.",
  published: "Vaga publicada.",
  paused: "Vaga pausada: o link mostra que ela não está recebendo candidaturas.",
  closed: "Vaga encerrada.",
};

export default async function CompanyJobPage({ params, searchParams }: PageProps<"/empresa/vagas/[id]">) {
  const [{ id }, { salvo, erro }] = await Promise.all([params, searchParams]);
  const [{ company }, job] = await Promise.all([requireMembership(), getJobForUser(id)]);
  if (!job || job.company_id !== company.id) notFound();

  const supabase = await createClient();
  const [history, { data: views }, { count: applications }] = await Promise.all([
    getModerationHistory(job.id),
    supabase.rpc("job_view_counts", { target_jobs: [job.id] }),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("job_id", job.id),
  ]);
  const viewRows = ((views ?? []) as { source: string; total: number }[]).sort((a, b) => b.total - a.total);
  const totalViews = viewRows.reduce((sum, row) => sum + Number(row.total), 0);
  const lastDecision = history[0];
  const savedMessage = typeof salvo === "string" ? SAVED_MESSAGES[salvo as JobStatus] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/empresa/vagas" className="text-sm font-semibold text-primary hover:underline">
        ← Todas as vagas
      </Link>
      {savedMessage && <Alert variant="success">{savedMessage}</Alert>}
      {typeof erro === "string" && <Alert variant="destructive">{erro}</Alert>}
      {job.status === "in_review" && company.status !== "approved" && (
        <Alert>A vaga será publicada depois que o cadastro da empresa for aprovado.</Alert>
      )}
      {(job.status === "rejected" || job.status === "draft") && lastDecision && lastDecision.decision !== "approved" && (
        <Alert variant={job.status === "rejected" ? "destructive" : "default"}>
          <strong>{MODERATION_DECISIONS[lastDecision.decision]}:</strong> {lastDecision.reason}
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <JobHeader job={job} />
          <JobStatusBadge status={job.status} />
        </div>
        <JobActions job={job} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <JobFacts job={job} />
          <JobBody job={job} />
          {job.job_questions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-extrabold">Perguntas de triagem</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {job.job_questions.map((q) => (
                  <li key={q.id}>
                    {q.question}{" "}
                    <span className="text-muted-foreground">
                      ({QUESTION_TYPES[q.type]}
                      {q.type === "single_choice" && `: ${q.options.join(", ")}`}
                      {!q.is_required && ", opcional"})
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {job.status === "published" ? (
            <section className="flex flex-col gap-3 rounded-xl border p-4">
              <h2 className="font-extrabold">Divulgue a vaga</h2>
              <Link
                href={jobPath(job.slug)}
                target="_blank"
                className="flex items-center gap-1 break-all text-sm font-semibold text-primary hover:underline"
              >
                {jobUrl(job.slug).replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5 shrink-0" />
              </Link>
              <ShareButtons url={jobUrl(job.slug)} text={`Vaga: ${job.title} – ${company.trade_name}`} />
              <Button asChild size="sm" variant="secondary" className="w-fit">
                <Link href={`/empresa/talentos?vaga=${job.id}`}>Ver currículos sugeridos</Link>
              </Button>
              <div className="flex flex-col items-center gap-2 rounded-lg bg-muted p-3">
                <Image
                  src={`${jobPath(job.slug)}/qrcode?formato=svg`}
                  alt="QR Code da vaga"
                  width={180}
                  height={180}
                  unoptimized
                  className="rounded bg-white p-2"
                />
                <Button asChild size="sm" variant="outline">
                  <a href={`${jobPath(job.slug)}/qrcode`} download={`vaga-${job.slug}.png`}>
                    <Download /> Baixar QR Code para cartaz
                  </a>
                </Button>
              </div>
            </section>
          ) : (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              O link público e o QR Code ficam disponíveis quando a vaga estiver publicada. Situação atual:{" "}
              {JOB_STATUSES[job.status].toLowerCase()}.
            </p>
          )}

          <section className="flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-extrabold">Desempenho do link</h2>
            <p className="text-sm">
              <strong className="font-heading text-2xl font-black">{totalViews}</strong> visualizações ·{" "}
              <strong className="font-heading text-2xl font-black">{applications ?? 0}</strong> candidaturas
            </p>
            {(applications ?? 0) > 0 && (
              <Button asChild size="sm" className="w-fit">
                <Link href={`/empresa/candidatos?vaga=${job.id}`}>Ver candidatos</Link>
              </Button>
            )}
            {viewRows.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {viewRows.map((row) => (
                  <li key={row.source} className="flex justify-between">
                    <span>{VIEW_SOURCES[row.source] ?? row.source}</span>
                    <span className="tabular-nums">{row.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border p-4">
              <h2 className="font-extrabold">Histórico de análise</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <strong>{MODERATION_DECISIONS[entry.decision]}</strong>{" "}
                    <span className="text-muted-foreground">em {formatDateTime(entry.created_at)}</span>
                    {entry.reason && <p className="text-muted-foreground">{entry.reason}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
