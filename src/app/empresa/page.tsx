import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { JobStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getMyMembership } from "@/lib/company";
import { addDays, formatDate, todayInBrazil } from "@/lib/format";
import type { JobStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Área da empresa" };

type JobRow = { id: string; title: string; status: JobStatus; closes_at: string | null };

export default async function CompanyHome({ searchParams }: PageProps<"/empresa">) {
  const membership = await getMyMembership();
  const { cadastro } = await searchParams;

  if (!membership) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Comece cadastrando sua empresa" />
        <Alert>Informe CNPJ, endereço e logotipo. Depois da aprovação, suas vagas podem ser publicadas.</Alert>
        <Button asChild className="w-fit">
          <Link href="/empresa/dados">Cadastrar empresa</Link>
        </Button>
      </div>
    );
  }

  const { company } = membership;
  const supabase = await createClient();
  const [{ data: jobs }, { count: applications }] = await Promise.all([
    supabase.from("jobs").select("id, title, status, closes_at").eq("company_id", company.id).overrideTypes<JobRow[], { merge: false }>(),
    supabase.from("applications").select("id, jobs!inner(company_id)", { count: "exact", head: true }).eq("jobs.company_id", company.id),
  ]);

  const today = todayInBrazil();
  const limit = addDays(today, 7);
  const all = jobs ?? [];
  const closingSoon = all.filter((job) => job.status === "published" && job.closes_at && job.closes_at <= limit);
  const metrics = [
    { label: "Vagas publicadas", value: all.filter((job) => job.status === "published").length, href: "/empresa/vagas?status=published" },
    { label: "Em análise", value: all.filter((job) => job.status === "in_review").length, href: "/empresa/vagas?status=in_review" },
    { label: "Encerram em 7 dias", value: closingSoon.length, href: "/empresa/vagas?status=published" },
    { label: "Candidaturas recebidas", value: applications ?? 0, href: "/empresa/candidatos" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={company.trade_name}
        actions={
          <Button asChild>
            <Link href="/empresa/vagas/nova">
              <Plus /> Nova vaga
            </Link>
          </Button>
        }
      />
      {cadastro === "enviado" && (
        <Alert variant="success">Cadastro enviado! Avisaremos por e-mail quando a análise terminar.</Alert>
      )}
      {company.status === "pending" && (
        <Alert>
          Cadastro da empresa em análise. Você já pode criar vagas e enviá-las para análise; elas são publicadas após a
          aprovação da empresa.
        </Alert>
      )}
      {company.status === "rejected" && (
        <Alert variant="destructive">
          Cadastro não aprovado{company.status_reason ? `: ${company.status_reason}` : "."}{" "}
          <Link href="/empresa/dados" className="font-semibold underline">
            Corrigir dados
          </Link>
        </Alert>
      )}
      {company.status === "blocked" && <Alert variant="destructive">Empresa bloqueada. Fale com o suporte do Trivagas.</Alert>}

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(({ label, value, href }) => (
          <Link key={label} href={href} className="rounded-xl border p-5 transition-colors hover:border-primary">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{value}</dd>
          </Link>
        ))}
      </dl>

      {closingSoon.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">Próximas do encerramento</h2>
          <ul className="divide-y rounded-xl border">
            {closingSoon.map((job) => (
              <li key={job.id}>
                <Link href={`/empresa/vagas/${job.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted">
                  <span className="font-semibold">{job.title}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    encerra em {formatDate(job.closes_at)} <JobStatusBadge status={job.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
