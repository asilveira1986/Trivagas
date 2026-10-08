import { AreaShell } from "@/components/layout/area-shell";
import { requireRole } from "@/lib/auth";

export default async function CompanyLayout({ children }: LayoutProps<"/empresa">) {
  const profile = await requireRole("company");
  return <AreaShell profile={profile}>{children}</AreaShell>;
}
