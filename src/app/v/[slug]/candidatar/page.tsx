import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MapPin, Phone, UserRound } from "lucide-react";
import { StageBadge } from "@/components/status-stage";
import { PdfUpload } from "@/components/resume/pdf-upload";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import { getPublishedJob, locationLabel } from "@/lib/jobs";
import type { ApplicationStage } from "@/lib/labels";
import { jobPath } from "@/lib/links";
import { getMyResume, signedResumePdfUrl } from "@/lib/resume";
import { createClient } from "@/lib/supabase/server";
import { applyToJob } from "./actions";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Candidatar-se", robots: { index: false } };

export default async function ApplyPage({ params, searchParams }: PageProps<"/v/[slug]/candidatar">) {
  const [{ slug }, { origem }] = await Promise.all([params, searchParams]);
  const [job, profile] = await Promise.all([getPublishedJob(slug), getCurrentProfile()]);
  if (!job) notFound();

  const origin = typeof origem === "string" ? origem : null;
  const here = `${jobPath(job.slug)}/candidatar${origin ? `?origem=${origin}` : ""}`;
  const next = encodeURIComponent(here);
  const header = (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-muted-foreground">Candidatura</p>
      <h1 className="text-2xl font-black leading-tight">{job.title}</h1>
      <p className="text-sm text-muted-foreground">
        {job.companies?.trade_name} · {locationLabel(job)}
      </p>
    </div>
  );

  if (!profile) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10">
        {header}
        <p>Crie sua conta em menos de um minuto para enviar a candidatura. Seus dados ficam salvos para as próximas vagas.</p>
        <Button asChild size="lg">
          <Link href={`/cadastro?perfil=candidato&next=${next}`}>Criar conta e me candidatar</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/entrar?next=${next}`}>Já tenho conta</Link>
        </Button>
      </div>
    );
  }
  if (!profile.onboarded_at) redirect(`/boas-vindas?perfil=candidato&next=${next}`);

  if (profile.role !== "candidate") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
        {header}
        <Alert>Candidaturas são feitas com uma conta de candidato. Você está conectado com uma conta de {profile.role === "company" ? "empresa" : "administrador"}.</Alert>
        <Button asChild variant="outline">
          <Link href={jobPath(job.slug)}>Voltar para a vaga</Link>
        </Button>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: existing }, resume, { data: city }, { data: invite }] = await Promise.all([
    supabase.from("applications").select("id, stage").eq("job_id", job.id).maybeSingle<{ id: string; stage: ApplicationStage }>(),
    getMyResume(),
    profile.city_id
      ? supabase.from("cities").select("name, states(uf)").eq("id", profile.city_id).maybeSingle<{ name: string; states: { uf: string } | null }>()
      : Promise.resolve({ data: null }),
    supabase.from("talent_invites").select("message").eq("job_id", job.id).eq("status", "pending").maybeSingle<{ message: string | null }>(),
  ]);

  if (existing) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
        {header}
        <Alert variant="success">
          Você já se candidatou a esta vaga. Situação: <StageBadge stage={existing.stage} audience="candidate" />
        </Alert>
        <Button asChild variant="outline">
          <Link href="/candidato/candidaturas">Ver minhas candidaturas</Link>
        </Button>
      </div>
    );
  }

  const pdfUrl = await signedResumePdfUrl(resume?.pdf_path ?? null);
  const missingContact = !profile.phone || !profile.city_id;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      {header}

      {invite && (
        <Alert variant="success">
          <strong>{job.companies?.trade_name} convidou você para esta vaga.</strong> Ao enviar a candidatura, você aceita o
          convite e seus contatos são liberados para a empresa.
          {invite.message && <span className="mt-1 block">“{invite.message}”</span>}
        </Alert>
      )}

      {job.affirmative === "pcd" && (
        <Alert>
          Vaga para pessoas com deficiência. Se quiser, registre sua declaração em{" "}
          <Link href="/candidato/privacidade" className="font-semibold underline">
            Privacidade
          </Link>{" "}
          antes de enviar: ela será mostrada só para esta empresa.
        </Alert>
      )}

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-extrabold">Seus dados</h2>
          <Link href="/candidato/curriculo" className="text-sm font-semibold text-primary hover:underline">
            Editar currículo
          </Link>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" /> {profile.full_name}
            {resume?.headline && <span className="text-muted-foreground">· {resume.headline}</span>}
          </li>
          <li className="flex items-center gap-2">
            <Phone className="size-4 text-primary" /> {formatPhone(profile.phone) || "Telefone não informado"}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" /> {city ? `${city.name} - ${city.states?.uf}` : "Cidade não informada"}
          </li>
        </ul>
        {missingContact && (
          <Alert variant="destructive">Informe telefone e cidade no currículo para a empresa conseguir falar com você.</Alert>
        )}
        <div className="border-t pt-3">
          <p className="mb-2 text-sm font-semibold">Currículo em PDF (opcional)</p>
          <PdfUpload userId={profile.id} downloadUrl={pdfUrl} />
        </div>
      </section>

      <ApplyForm
        action={applyToJob.bind(null, job.id, origin)}
        questions={job.job_questions}
        companyName={job.companies?.trade_name ?? "a empresa"}
      />
    </div>
  );
}
