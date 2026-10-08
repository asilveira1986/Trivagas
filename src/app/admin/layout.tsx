import { AreaShell } from "@/components/layout/area-shell";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Início" },
  { href: "/admin/vagas", label: "Moderação de vagas" },
  { href: "/admin/empresas", label: "Empresas" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireRole("admin");
  return (
    <AreaShell profile={profile} nav={NAV}>
      {children}
    </AreaShell>
  );
}
