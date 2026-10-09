import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administração" };

type Metrics = Record<string, number | null>;

const GROUPS: { title: string; items: { key: string; label: string; href?: string; suffix?: string }[] }[] = [
  {
    title: "Operação",
    items: [
      { key: "jobs_in_review", label: "Vagas aguardando análise", href: "/admin/vagas" },
      { key: "companies_pending", label: "Empresas aguardando aprovação", href: "/admin/empresas" },
      { key: "reports_open", label: "Denúncias abertas", href: "/admin/denuncias" },
      { key: "avg_moderation_hours_30d", label: "Tempo médio de moderação (30 dias)", suffix: " h" },
    ],
  },
  {
    title: "Portal",
    items: [
      { key: "companies_active", label: "Empresas ativas", href: "/admin/empresas?status=approved" },
      { key: "jobs_published", label: "Vagas publicadas", href: "/admin/vagas?status=published" },
      { key: "applications_total", label: "Candidaturas" },
      { key: "applications_30d", label: "Candidaturas (30 dias)" },
      { key: "candidates", label: "Candidatos cadastrados", href: "/admin/usuarios?papel=candidate" },
      { key: "signups_30d", label: "Novos cadastros (30 dias)" },
      { key: "talent_pool_active", label: "Currículos no banco de talentos" },
      { key: "job_views_30d", label: "Visualizações de vagas (30 dias)" },
    ],
  },
];

export default async function AdminHome() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_metrics");
  const metrics = (data ?? {}) as Metrics;
  const format = (value: number | null | undefined, suffix = "") => {
    if (value == null) return "—";
    if (suffix === " h" && value < 1) return "< 1 h";
    return `${new Intl.NumberFormat("pt-BR").format(value)}${suffix}`;
  };

  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">{group.title}</h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {group.items.map(({ key, label, href, suffix }) => {
              const content = (
                <>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{format(metrics[key], suffix)}</dd>
                </>
              );
              return href ? (
                <Link key={key} href={href} className="rounded-xl border p-4 transition-colors hover:border-primary">
                  {content}
                </Link>
              ) : (
                <div key={key} className="rounded-xl border p-4">
                  {content}
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
