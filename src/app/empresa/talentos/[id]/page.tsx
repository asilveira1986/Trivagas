import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, MapPin, X } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { ResumeView } from "@/components/resume/resume-view";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cityLabel, requireMembership } from "@/lib/company";
import { INVITE_STATUSES, type InviteStatus } from "@/lib/labels";
import { RESUME_COLUMNS, sortResume, type ResumeDetail } from "@/lib/resume";
import { createClient } from "@/lib/supabase/server";
import { getTalentIdentity } from "@/lib/talent";
import { inviteTalent, saveTalent, unsaveTalent } from "../actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Perfil do talento" };

export default async function TalentProfilePage({ params, searchParams }: PageProps<"/empresa/talentos/[id]">) {
  const [{ id }, { vaga }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { company } = await requireMembership();
  if (company.status !== "approved") notFound();

  const supabase = await createClient();
  const [identity, { data: resume }] = await Promise.all([
    getTalentIdentity(id),
    supabase.from("resumes").select(RESUME_COLUMNS).eq("id", id).maybeSingle<ResumeDetail>(),
  ]);
  if (!identity || !resume) notFound();
  sortResume(resume);

  const [{ data: experienceMonths }, { data: jobs }, { data: invites }, { data: applications }, { data: saved }, { data: lists }] =
    await Promise.all([
      supabase.rpc("resume_experience_months", { target_resume: id }),
      supabase.from("jobs").select("id, title").eq("company_id", company.id).eq("status", "published").order("published_at", { ascending: false }),
      supabase.from("talent_invites").select("job_id, status").eq("resume_id", id),
      supabase.from("applications").select("job_id").eq("resume_id", id),
      supabase.from("saved_resumes").select("list_name").eq("company_id", company.id).eq("resume_id", id),
      supabase.from("saved_resumes").select("list_name").eq("company_id", company.id),
      // LGPD: registra o acesso ao perfil do banco de talentos.
      supabase.rpc("log_audit", {
        audit_action: "view_talent",
        audit_entity: "resumes",
        audit_entity_id: id,
        audit_metadata: { company_id: company.id },
      }),
    ]);

  const inviteByJob = new Map(((invites ?? []) as { job_id: string; status: InviteStatus }[]).map((i) => [i.job_id, i.status]));
  const appliedJobs = new Set((applications ?? []).map((a: { job_id: string }) => a.job_id));
  const jobOptions = ((jobs ?? []) as { id: string; title: string }[]).map((job) => ({
    ...job,
    unavailable: appliedJobs.has(job.id)
      ? "já se candidatou"
      : inviteByJob.has(job.id)
        ? INVITE_STATUSES[inviteByJob.get(job.id)!].toLowerCase()
        : null,
  }));
  const savedLists = ((saved ?? []) as { list_name: string }[]).map((s) => s.list_name);
  const allLists = [...new Set(((lists ?? []) as { list_name: string }[]).map((l) => l.list_name).concat("Favoritos"))];
  const back = typeof vaga === "string" ? `/empresa/talentos?vaga=${vaga}` : "/empresa/talentos";

  return (
    <div className="flex flex-col gap-6">
      <Link href={back} className="text-sm font-semibold text-primary hover:underline">
        ← Banco de talentos
      </Link>
      <PageHeader
        title={identity.display_name}
        description={
          <span className="flex flex-col gap-1">
            {resume.headline && <span>{resume.headline}</span>}
            {resume.cities && (
              <span className="flex items-center gap-1">
                <MapPin className="size-4" /> {cityLabel(resume.cities)}
              </span>
            )}
          </span>
        }
      />

      {identity.contact_released ? (
        <Alert variant="success">
          Este candidato se candidatou a uma vaga da empresa: contato e PDF estão liberados.{" "}
          {identity.application_id && (
            <Link href={`/empresa/candidatos/${identity.application_id}`} className="font-semibold underline">
              Ver candidatura
            </Link>
          )}
        </Alert>
      ) : (
        <Alert>Nome completo, telefone, e-mail e PDF ficam ocultos até o candidato aceitar um convite ou se candidatar.</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="order-2 lg:order-1">
          <ResumeView resume={resume} experienceMonths={experienceMonths as number | null} />
        </div>
        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="font-extrabold">Convidar para uma vaga</h2>
            {jobOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Publique uma vaga para enviar convites.</p>
            ) : (
              <InviteForm
                action={inviteTalent.bind(null, id)}
                jobs={jobOptions}
                defaultJobId={typeof vaga === "string" ? vaga : null}
                candidateName={identity.display_name}
              />
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="flex items-center gap-2 font-extrabold">
              <Bookmark className="size-4 text-primary" /> Listas
            </h2>
            {savedLists.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {savedLists.map((list) => (
                  <li key={list}>
                    <form action={unsaveTalent} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm font-semibold">
                      {list}
                      <input type="hidden" name="resumeId" value={id} />
                      <input type="hidden" name="listName" value={list} />
                      <button type="submit" aria-label={`Remover de ${list}`} className="rounded-full p-0.5 hover:bg-primary/20">
                        <X className="size-3.5" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveTalent} className="flex gap-2">
              <input type="hidden" name="resumeId" value={id} />
              <Input name="listName" list="talent-lists" placeholder="Favoritos" maxLength={60} aria-label="Nome da lista" />
              <datalist id="talent-lists">
                {allLists.map((list) => (
                  <option key={list} value={list} />
                ))}
              </datalist>
              <Button type="submit" variant="outline">
                Salvar
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
