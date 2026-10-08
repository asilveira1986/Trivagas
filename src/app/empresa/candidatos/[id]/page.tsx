import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Mail, MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { ResumeView } from "@/components/resume/resume-view";
import { StageBadge } from "@/components/status-stage";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { cityLabel, requireMembership } from "@/lib/company";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { APPLICATION_STAGES, VIEW_SOURCES, type ApplicationSource, type ApplicationStage } from "@/lib/labels";
import { RESUME_COLUMNS, signedResumePdfUrl, sortResume, type ResumeDetail } from "@/lib/resume";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { addNote, deleteNote, updateRating, updateStage } from "../actions";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "Candidato" };

type ApplicationDetail = {
  id: string;
  stage: ApplicationStage;
  rating: number | null;
  source: ApplicationSource;
  source_detail: string | null;
  created_at: string;
  jobs: { id: string; title: string; company_id: string } | null;
  resumes: (ResumeDetail & { profiles: { full_name: string; email: string | null; phone: string | null } | null }) | null;
  application_answers: { answer: string; job_questions: { question: string; position: number } | null }[];
  application_notes: { id: string; body: string; created_at: string; author_id: string | null; profiles: { full_name: string } | null }[];
};

const STAGES = Object.keys(APPLICATION_STAGES) as ApplicationStage[];

export default async function ApplicationPage({ params }: PageProps<"/empresa/candidatos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [profile, { company }] = await Promise.all([requireProfile(), requireMembership()]);

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select(
      `id, stage, rating, source, source_detail, created_at,
       jobs(id, title, company_id),
       resumes(${RESUME_COLUMNS}, profiles(full_name, email, phone)),
       application_answers(answer, job_questions(question, position)),
       application_notes(id, body, created_at, author_id, profiles(full_name))`,
    )
    .eq("id", id)
    .maybeSingle<ApplicationDetail>();
  if (!application || application.jobs?.company_id !== company.id || !application.resumes) notFound();

  const resume = sortResume(application.resumes);
  const candidate = resume.profiles;
  const [pdfUrl, { data: experienceMonths }] = await Promise.all([
    signedResumePdfUrl(resume.pdf_path),
    supabase.rpc("resume_experience_months", { target_resume: resume.id }),
    // LGPD: registra o acesso da empresa ao currículo.
    supabase.rpc("log_audit", {
      audit_action: "view_resume",
      audit_entity: "resumes",
      audit_entity_id: resume.id,
      audit_metadata: { application_id: application.id, company_id: company.id },
    }),
  ]);
  const answers = [...application.application_answers].sort(
    (a, b) => (a.job_questions?.position ?? 0) - (b.job_questions?.position ?? 0),
  );
  const notes = [...application.application_notes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const phoneDigits = (candidate?.phone ?? "").replace(/\D/g, "");

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/empresa/candidatos?vaga=${application.jobs!.id}`} className="text-sm font-semibold text-primary hover:underline">
        ← Candidatos da vaga
      </Link>

      <PageHeader
        title={candidate?.full_name ?? "Candidato"}
        description={
          <span className="flex flex-col gap-1">
            {resume.headline && <span>{resume.headline}</span>}
            <span>
              Candidatura para <strong className="text-foreground">{application.jobs!.title}</strong> em{" "}
              {formatDate(application.created_at)} ·{" "}
              {application.source === "invite" ? "convite" : (VIEW_SOURCES[application.source_detail ?? "direct"] ?? "link").toLowerCase()}
            </span>
          </span>
        }
        actions={<StageBadge stage={application.stage} audience="company" />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
            <h2 className="font-extrabold">Contato</h2>
            {candidate?.phone && (
              <span className="flex flex-wrap items-center gap-2">
                <Phone className="size-4 text-primary" /> {formatPhone(candidate.phone)}
                <a
                  href={`https://wa.me/55${phoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </span>
            )}
            {candidate?.email && (
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 hover:text-primary">
                <Mail className="size-4 text-primary" /> {candidate.email}
              </a>
            )}
            {resume.cities && (
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" /> {cityLabel(resume.cities)}
              </span>
            )}
            {pdfUrl && (
              <Button asChild size="sm" variant="outline" className="mt-1 w-fit">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Download /> Baixar currículo em PDF
                </a>
              </Button>
            )}
          </section>

          {answers.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-extrabold">Respostas de triagem</h2>
              <dl className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
                {answers.map((a, index) => (
                  <div key={index}>
                    <dt className="text-muted-foreground">{a.job_questions?.question}</dt>
                    <dd className="font-semibold">{a.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <ResumeView resume={resume} experienceMonths={experienceMonths as number | null} />
        </div>

        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="font-extrabold">Etapa</h2>
            <form action={updateStage} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="applicationId" value={application.id} />
              {STAGES.map((stage) => (
                <Button
                  key={stage}
                  type="submit"
                  name="stage"
                  value={stage}
                  size="sm"
                  variant={application.stage === stage ? "default" : "outline"}
                  className={cn(stage === "rejected" && application.stage !== stage && "text-destructive")}
                  aria-pressed={application.stage === stage}
                >
                  {APPLICATION_STAGES[stage]}
                </Button>
              ))}
            </form>
            <p className="text-xs text-muted-foreground">O candidato recebe e-mail ao ir para entrevista, aprovado ou reprovado.</p>
          </section>

          <section className="flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-extrabold">Avaliação</h2>
            <form action={updateRating} className="flex gap-1">
              <input type="hidden" name="applicationId" value={application.id} />
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="submit"
                  name="rating"
                  value={application.rating === n ? 0 : n}
                  aria-label={`Nota ${n}`}
                  className="rounded p-1 hover:bg-muted"
                >
                  <Star className={cn("size-6", application.rating && n <= application.rating ? "fill-accent text-accent" : "text-border")} />
                </button>
              ))}
            </form>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="font-extrabold">Anotações internas</h2>
            <NoteForm action={addNote.bind(null, application.id)} />
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li key={note.id} className="flex flex-col gap-1 border-t pt-3 text-sm">
                  <p className="whitespace-pre-line">{note.body}</p>
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    {note.profiles?.full_name ?? "Usuário"} · {formatDateTime(note.created_at)}
                    {note.author_id === profile.id && (
                      <form action={deleteNote}>
                        <input type="hidden" name="noteId" value={note.id} />
                        <input type="hidden" name="applicationId" value={application.id} />
                        <button type="submit" className="font-semibold text-destructive hover:underline">
                          Excluir
                        </button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
