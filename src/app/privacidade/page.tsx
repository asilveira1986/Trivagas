import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { PRIVACY_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-black">Política de privacidade</h1>
      <p className="text-sm text-muted-foreground">Versão {PRIVACY_VERSION}</p>
      <Alert>
        Texto provisório. A versão definitiva, com a indicação do encarregado de dados (DPO), será publicada após
        revisão jurídica, antes do lançamento.
      </Alert>
      <ul className="list-disc space-y-2 pl-5">
        <li>Seu currículo só entra no banco de talentos com sua autorização expressa, que pode ser retirada a qualquer momento.</li>
        <li>Sem essa autorização, o currículo é visto apenas pelas empresas das vagas em que você se candidatou.</li>
        <li>Telefone e e-mail só são liberados quando você se candidata ou aceita um convite.</li>
        <li>Currículos inativos por 6 meses são removidos definitivamente, com aviso prévio.</li>
        <li>Você pode ver, corrigir, baixar e excluir seus dados.</li>
      </ul>
    </article>
  );
}
