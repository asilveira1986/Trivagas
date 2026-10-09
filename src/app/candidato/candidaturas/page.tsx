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
import { declineInvite, withdrawApplication } from "../actions";

export const metadata: Metadata = { title: "Minhas candidaturas" };

type InviteRow = {
  id: string;
  message: string | null;
  created_at: string;
  jobs: { title: string; slug: string; status: JobStatus; is_confidential: boolean; companies: { trade_name: string } | null } | null;
};

type Row = {
  id: string;
  stage: ApplicationStage;
  created_at: string;
  updated_at: string;
  jobs: { title: string; slug: string; status: JobStatus; is_confidential: boolean; companies: { trade_name: string } | null } | null;
};

export default async function MyApplicationsPage({ searchParams }: PageProps<"/candidato/candidaturas">) {
  await requireRole("candidate");
  const { nova, desistencia } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: inviteRows }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, stage, created_at, updated_at, jobs(title, slug, status, is_confidential, companies(trade_name))")
      .order("created_at", { ascending: false })
      .overrideTypes<Row[], { merge: false }>(),
    supabase
      .from("talent_invites")
      .select("id, message, created_at, jobs(title, slug, status, is_confidential, companies(trade_name))")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .overrideTypes<InviteRow[], { merge: false }>(),
  ]);
  const applications = data ?? [];
  const invites = (inviteRows ?? []).filter((invite) => invite.jobs?.status === "published");

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

      {invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">Convites de empresas</h2>
          <ul className="flex flex-col gap-3">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-col gap-3 rounded-xl border-2 border-accent bg-accent/10 p-4">
                <div className="flex flex-col">
                  <span className="text-lg font-extrabold">{invite.jobs?.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {invite.jobs?.is_confidential ? "Empresa confidencial" : invite.jobs?.companies?.trade_name} · convite de {formatDate(invite.created_at)}
                  </span>
                </div>
                {invite.message && <p className="text-sm">“{invite.message}”</p>}
                <p className="text-xs text-muted-foreground">Seus contatos só são enviados à empresa se você aceitar.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`${jobPath(invite.jobs!.slug)}/candidatar`}>Ver vaga e aceitar</Link>
                  </Button>
                  <form action={declineInvite}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Recusar
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invites.length > 0 && applications.length > 0 && <h2 className="text-lg font-extrabold">Candidaturas</h2>}
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
                      {job?.is_confidential ? "Empresa confidencial" : job?.companies?.trade_name} · enviada em {formatDate(application.created_at)}
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
