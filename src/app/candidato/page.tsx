import type { Metadata } from "next";
import { ComingSoonCard } from "@/components/layout/area-shell";

export const metadata: Metadata = { title: "Área do candidato" };

export default function CandidateHome() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ComingSoonCard
        title="Meu currículo"
        text="Experiências, formação, habilidades e envio do PDF."
        phase="Fase 2"
      />
      <ComingSoonCard
        title="Minhas candidaturas"
        text="Acompanhe o status de cada vaga em que você se candidatou."
        phase="Fase 2"
      />
      <ComingSoonCard
        title="Banco de talentos"
        text="Autorize, pause ou retire seu currículo da busca das empresas."
        phase="Fase 3"
      />
    </div>
  );
}
