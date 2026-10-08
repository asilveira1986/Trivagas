import type { Metadata } from "next";
import { ComingSoonCard } from "@/components/layout/area-shell";
import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Área da empresa" };

const STATUS_TEXT = {
  pending: "Cadastro da empresa em análise. Você poderá publicar vagas após a aprovação.",
  approved: "Cadastro aprovado. Sua empresa já pode publicar vagas.",
  rejected: "Cadastro da empresa não aprovado. Revise os dados e fale com o suporte.",
  blocked: "Empresa bloqueada. Fale com o suporte do Trivagas.",
} as const;

type Membership = {
  role: "admin" | "recruiter";
  companies: { trade_name: string; status: keyof typeof STATUS_TEXT } | null;
};

export default async function CompanyHome() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select("role, companies(trade_name, status)")
    .limit(1)
    .maybeSingle<Membership>();
  const company = data?.companies;

  return (
    <div className="flex flex-col gap-6">
      {company ? (
        <Alert variant={company.status === "approved" ? "success" : company.status === "pending" ? "default" : "destructive"}>
          <strong>{company.trade_name}:</strong> {STATUS_TEXT[company.status]}
        </Alert>
      ) : (
        <Alert>Cadastre os dados da sua empresa (CNPJ, endereço e logotipo) para começar a anunciar.</Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ComingSoonCard title="Dados da empresa" text="CNPJ, razão social, endereço, contatos e logotipo." phase="Fase 1" />
        <ComingSoonCard
          title="Minhas vagas"
          text="Crie vagas, envie para análise e compartilhe o link por WhatsApp, redes e QR Code."
          phase="Fase 1"
        />
        <ComingSoonCard title="Candidatos" text="Funil por vaga com anotações e nota de avaliação." phase="Fase 2" />
        <ComingSoonCard title="Banco de currículos" text="Sugestões por região e aderência à vaga." phase="Fase 3" />
        <ComingSoonCard title="Usuários" text="Convide recrutadores para a sua empresa." phase="Fase 1" />
      </div>
    </div>
  );
}
