import { after } from "next/server";
import { AreaShell } from "@/components/layout/area-shell";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/candidato", label: "Início" },
  { href: "/candidato/curriculo", label: "Meu currículo" },
  { href: "/candidato/candidaturas", label: "Candidaturas" },
  { href: "/candidato/alertas", label: "Alertas" },
  { href: "/candidato/privacidade", label: "Privacidade" },
];

export default async function CandidateLayout({ children }: LayoutProps<"/candidato">) {
  const profile = await requireRole("candidate");
  // Registra a atividade (o banco grava no máximo uma vez a cada 12 h) — base da retenção de dados.
  const supabase = await createClient();
  after(async () => {
    await supabase.rpc("touch_last_active");
  });
  return (
    <AreaShell profile={profile} nav={NAV}>
      {children}
    </AreaShell>
  );
}
