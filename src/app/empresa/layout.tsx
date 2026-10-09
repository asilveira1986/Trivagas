import { after } from "next/server";
import { AreaShell } from "@/components/layout/area-shell";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/empresa", label: "Início" },
  { href: "/empresa/vagas", label: "Vagas" },
  { href: "/empresa/candidatos", label: "Candidatos" },
  { href: "/empresa/talentos", label: "Banco de talentos" },
  { href: "/empresa/relatorios", label: "Relatórios" },
  { href: "/empresa/dados", label: "Dados da empresa" },
  { href: "/empresa/usuarios", label: "Usuários" },
];

export default async function CompanyLayout({ children }: LayoutProps<"/empresa">) {
  const profile = await requireRole("company");
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
