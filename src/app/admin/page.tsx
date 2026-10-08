import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonCard } from "@/components/layout/area-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminHome() {
  const supabase = await createClient();
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;

  const [candidates, companyUsers, pendingCompanies, jobsInReview, publishedJobs, openReports] = await Promise.all([
    count(supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "candidate")),
    count(supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "company")),
    count(supabase.from("companies").select("*", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "in_review")),
    count(supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "published")),
    count(supabase.from("job_reports").select("*", { count: "exact", head: true }).eq("status", "open")),
  ]);

  const metrics = [
    { label: "Candidatos", value: candidates },
    { label: "Usuários de empresa", value: companyUsers },
    { label: "Empresas aguardando aprovação", value: pendingCompanies, href: "/admin/empresas?status=pending" },
    { label: "Vagas em análise", value: jobsInReview, href: "/admin/vagas?status=in_review" },
    { label: "Vagas publicadas", value: publishedJobs, href: "/admin/vagas?status=published" },
    { label: "Denúncias abertas", value: openReports },
  ];

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {metrics.map(({ label, value, href }) => {
          const content = (
            <>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{value}</dd>
            </>
          );
          return href ? (
            <Link key={label} href={href} className="rounded-xl border p-5 transition-colors hover:border-primary">
              {content}
            </Link>
          ) : (
            <div key={label} className="rounded-xl border p-5">
              {content}
            </div>
          );
        })}
      </dl>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ComingSoonCard title="Denúncias de vagas" text="Fila de denúncias com retirada da vaga do ar." phase="Fase 4" />
        <ComingSoonCard title="Métricas gerais" text="Tempo médio de moderação, candidaturas e currículos no banco." phase="Fase 4" />
        <ComingSoonCard title="Catálogos" text="Áreas, habilidades, cidades e regiões." phase="Fase 4" />
      </div>
    </div>
  );
}
