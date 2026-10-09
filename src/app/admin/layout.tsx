import { AreaShell } from "@/components/layout/area-shell";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Início" },
  { href: "/admin/vagas", label: "Moderação de vagas" },
  { href: "/admin/empresas", label: "Empresas" },
  { href: "/admin/denuncias", label: "Denúncias" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/catalogos", label: "Catálogos e pesos" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireRole("admin");
  return (
    <AreaShell profile={profile} nav={NAV}>
      {children}
    </AreaShell>
  );
}
