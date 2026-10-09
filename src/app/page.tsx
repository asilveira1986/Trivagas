import Link from "next/link";
import { Building2, MapPin, Search, Share2, UserRound } from "lucide-react";
import { JobCard } from "@/components/jobs/job-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPublicJobs } from "@/lib/public-jobs";

const steps = [
  {
    icon: Building2,
    title: "Cadastre a vaga",
    text: "Empresa aprovada publica a vaga em poucos minutos; nossa equipe revisa antes de ir ao ar.",
  },
  {
    icon: Share2,
    title: "Compartilhe o link",
    text: "Cada vaga tem um link próprio para WhatsApp, redes sociais e QR Code em cartazes.",
  },
  {
    icon: MapPin,
    title: "Encontre gente da região",
    text: "Os currículos aparecem ordenados por proximidade e aderência à vaga.",
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const { conta } = await searchParams;
  const recent = await searchPublicJobs(
    { query: null, cityId: null, radiusKm: null, areaId: null, mode: null, contract: null, page: 1 },
    6,
  );
  return (
    <>
      {conta === "excluida" && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-6">
          <Alert variant="success">Sua conta e seus dados foram excluídos do Trivagas.</Alert>
        </div>
      )}
      <section className="bg-gradient-to-b from-primary/10 to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:py-20">
          <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground">
            Vagas em todo o Brasil
          </span>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
            A vaga certa, <span className="text-primary">perto de você</span>.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Empresas publicam e compartilham vagas por link. Candidatos se candidatam em poucos passos, direto do
            celular.
          </p>
          <form action="/vagas" className="flex max-w-xl gap-2">
            <Input name="q" placeholder="Cargo ou palavra-chave" aria-label="Cargo ou palavra-chave" className="h-12 bg-background" />
            <Button type="submit" size="lg">
              <Search /> Buscar
            </Button>
          </form>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline">
              <Link href="/cadastro?perfil=candidato">
                <UserRound /> Quero me candidatar
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/cadastro?perfil=empresa">
                <Building2 /> Quero anunciar vagas
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-14">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-2xl font-black sm:text-3xl">Vagas recentes</h2>
            <Link href="/vagas" className="text-sm font-semibold text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {recent.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-black sm:text-3xl">Como funciona</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-xl border p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-bold text-muted-foreground">Passo {index + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
