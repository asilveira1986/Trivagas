import { AreaShell } from "@/components/layout/area-shell";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/empresa", label: "Início" },
  { href: "/empresa/vagas", label: "Vagas" },
  { href: "/empresa/dados", label: "Dados da empresa" },
  { href: "/empresa/usuarios", label: "Usuários" },
];

export default async function CompanyLayout({ children }: LayoutProps<"/empresa">) {
  const profile = await requireRole("company");
  return (
    <AreaShell profile={profile} nav={NAV}>
      {children}
    </AreaShell>
  );
}
