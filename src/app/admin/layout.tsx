import { AreaShell } from "@/components/layout/area-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireRole("admin");
  return <AreaShell profile={profile}>{children}</AreaShell>;
}
