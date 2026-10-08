import { AreaShell } from "@/components/layout/area-shell";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/candidato", label: "Início" },
  { href: "/candidato/curriculo", label: "Meu currículo" },
  { href: "/candidato/candidaturas", label: "Candidaturas" },
  { href: "/candidato/privacidade", label: "Privacidade" },
];

export default async function CandidateLayout({ children }: LayoutProps<"/candidato">) {
  const profile = await requireRole("candidate");
  return (
    <AreaShell profile={profile} nav={NAV}>
      {children}
    </AreaShell>
  );
}
