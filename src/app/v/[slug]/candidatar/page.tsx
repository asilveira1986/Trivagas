import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getPublishedJob } from "@/lib/jobs";
import { jobPath } from "@/lib/links";

export const metadata: Metadata = { title: "Candidatar-se", robots: { index: false } };

// Fluxo completo de candidatura (currículo, PDF e perguntas de triagem) entra na Fase 2.
export default async function ApplyPage({ params }: PageProps<"/v/[slug]/candidatar">) {
  const { slug } = await params;
  const [job, profile] = await Promise.all([getPublishedJob(slug), getCurrentProfile()]);
  if (!job) notFound();
  const next = encodeURIComponent(`${jobPath(job.slug)}/candidatar`);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-black">Candidatura: {job.title}</h1>
      <Alert>
        As candidaturas online abrem em breve. Crie sua conta agora para ser um dos primeiros a se candidatar quando a
        etapa estiver liberada.
      </Alert>
      {profile ? (
        <Button asChild variant="outline">
          <Link href={jobPath(job.slug)}>Voltar para a vaga</Link>
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href={`/cadastro?perfil=candidato&next=${next}`}>Criar conta de candidato</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/entrar?next=${next}`}>Já tenho conta</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
