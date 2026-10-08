import { AreaShell } from "@/components/layout/area-shell";
import { requireRole } from "@/lib/auth";

export default async function CandidateLayout({ children }: LayoutProps<"/candidato">) {
  const profile = await requireRole("candidate");
  return <AreaShell profile={profile}>{children}</AreaShell>;
}
