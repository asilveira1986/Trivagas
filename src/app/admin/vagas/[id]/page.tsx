import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { moderateJob } from "@/app/admin/actions";
import { DecisionForm } from "@/components/admin/decision-form";
import { JobBody, JobFacts, JobHeader } from "@/components/jobs/job-details";
import { CompanyStatusBadge, JobStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/format";
import { getJobForUser, getModerationHistory } from "@/lib/jobs";
import { MODERATION_DECISIONS, QUESTION_TYPES } from "@/lib/labels";
import { jobPath } from "@/lib/links";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Analisar vaga" };

export default async function ModerateJobPage({ params }: PageProps<"/admin/vagas/[id]">) {
  const { id } = await params;
  const job = await getJobForUser(id);
  if (!job) notFound();
  const history = await getModerationHistory(job.id);
  const company = job.companies;
  const companyApproved = company?.status === "approved";
  const canModerate = ["in_review", "published", "paused"].includes(job.status);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/vagas" className="text-sm font-semibold text-primary hover:underline">
        ← Fila de análise
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <JobHeader job={job} />
            <JobStatusBadge status={job.status} />
          </div>
          <JobFacts job={job} />
          <JobBody job={job} />
          {job.job_questions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-extrabold">Perguntas de triagem</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {job.job_questions.map((q) => (
                  <li key={q.id}>
                    {q.question} <span className="text-muted-foreground">({QUESTION_TYPES[q.type]})</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
            <h2 className="font-extrabold">Empresa</h2>
            {company && (
              <>
                <Link href={`/admin/empresas/${company.id}`} className="font-semibold text-primary hover:underline">
                  {company.trade_name}
                </Link>
                <CompanyStatusBadge status={company.status} />
              </>
            )}
            {job.submitted_at && <p className="text-muted-foreground">Enviada para análise {timeAgo(job.submitted_at)}.</p>}
            {job.status === "published" && (
              <Link href={jobPath(job.slug)} target="_blank" className="font-semibold text-primary hover:underline">
                Abrir página pública
              </Link>
            )}
          </section>

          {canModerate ? (
            <section className="flex flex-col gap-3 rounded-xl border p-4">
              <h2 className="font-extrabold">{job.status === "in_review" ? "Decisão" : "Retirar do ar"}</h2>
              {!companyApproved && job.status === "in_review" && (
                <Alert>Aprove o cadastro da empresa antes de publicar esta vaga.</Alert>
              )}
              <DecisionForm
                action={moderateJob.bind(null, job.id)}
                fieldName="decision"
                options={[
                  ...(job.status === "in_review"
                    ? [{ value: "approved", label: "Aprovar e publicar", needsReason: false, disabled: !companyApproved }]
                    : []),
                  { value: "changes_requested", label: "Pedir ajuste", needsReason: true },
                  { value: "rejected", label: "Reprovar", needsReason: true },
                ]}
              />
            </section>
          ) : (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nenhuma decisão pendente para esta vaga.</p>
          )}

          {history.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
              <h2 className="font-extrabold">Histórico</h2>
              {history.map((entry) => (
                <div key={entry.id}>
                  <strong>{MODERATION_DECISIONS[entry.decision]}</strong>{" "}
                  <span className="text-muted-foreground">em {formatDateTime(entry.created_at)}</span>
                  {entry.reason && <p className="text-muted-foreground">{entry.reason}</p>}
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
