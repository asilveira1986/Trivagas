import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-black">Termos de uso</h1>
      <p className="text-sm text-muted-foreground">Versão {TERMS_VERSION}</p>
      <Alert>
        Texto provisório. A versão definitiva dos termos de uso será publicada após revisão jurídica, antes do
        lançamento.
      </Alert>
      <p>
        O Trivagas aproxima empresas que anunciam vagas e pessoas que buscam emprego. Toda vaga passa por moderação
        antes de ser publicada, e empresas só publicam após a aprovação do cadastro.
      </p>
    </article>
  );
}
