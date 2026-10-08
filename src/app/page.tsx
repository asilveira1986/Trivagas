import Link from "next/link";
import { Building2, MapPin, Share2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function Home() {
  return (
    <>
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
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
