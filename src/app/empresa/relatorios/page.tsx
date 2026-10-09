import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { JobStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/company";
import { APPLICATION_STAGES, VIEW_SOURCES, type ApplicationStage } from "@/lib/labels";
import { REPORT_PERIODS, getCompanyReport, parsePeriod } from "@/lib/reports";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios" };

const number = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const STAGES = Object.keys(APPLICATION_STAGES) as ApplicationStage[];

export default async function ReportsPage({ searchParams }: PageProps<"/empresa/relatorios">) {
  const { company } = await requireMembership();
  const { dias } = await searchParams;
  const days = parsePeriod(dias);
  const report = await getCompanyReport(company.id, days);
  const maxSource = report.viewsBySource[0]?.[1] ?? 0;

  const kpis = [
    { label: "Visualizações dos links", value: number.format(report.totals.views) },
    { label: "Candidaturas", value: number.format(report.totals.applications) },
    { label: "Conversão (candidaturas ÷ visualizações)", value: report.totals.conversion == null ? "—" : percent.format(report.totals.conversion) },
    {
      label: "Tempo médio até encerrar a vaga",
      value: report.totals.avgDaysToClose == null ? "—" : `${number.format(Math.round(report.totals.avgDaysToClose))} dias`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Retorno de cada anúncio: de onde vêm as visitas, quantas viram candidatura e quanto tempo a vaga levou para fechar."
        actions={
          <Button asChild variant="outline">
            <a href={`/empresa/relatorios/csv?dias=${days}`} download>
              <Download /> Exportar CSV
            </a>
          </Button>
        }
      />

      <nav className="flex gap-2" aria-label="Período">
        {REPORT_PERIODS.map((period) => (
          <Link
            key={period}
            href={`/empresa/relatorios?dias=${period}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-semibold",
              days === period ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary",
            )}
          >
            {period === 365 ? "12 meses" : `${period} dias`}
          </Link>
        ))}
      </nav>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border p-4">
            <dt className="text-sm text-muted-foreground">{kpi.label}</dt>
            <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Visualizações por origem do link</h2>
        {report.viewsBySource.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem visualizações no período. Compartilhe o link das vagas.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {report.viewsBySource.map(([source, total]) => (
              <li
                key={source}
                className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm"
                title={`${VIEW_SOURCES[source] ?? source}: ${number.format(total)} visualizações`}
              >
                <span className="truncate text-muted-foreground">{VIEW_SOURCES[source] ?? source}</span>
                <span className="h-3 rounded-r bg-muted">
                  <span className="block h-full rounded-r bg-primary" style={{ width: `${Math.max(2, (total / maxSource) * 100)}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{number.format(total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Por vaga</h2>
        {report.jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma vaga publicada no período.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Vaga</th>
                  <th className="p-3 text-right">Visualizações</th>
                  <th className="p-3 text-right">Candidaturas</th>
                  <th className="p-3 text-right">Conversão</th>
                  <th className="p-3">Principal origem</th>
                  <th className="p-3">Funil (todas as candidaturas)</th>
                  <th className="p-3 text-right">Dias até fechar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.jobs.map((job) => {
                  const topSource = Object.entries(job.views_by_source ?? {}).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <tr key={job.id}>
                      <td className="p-3">
                        <Link href={`/empresa/vagas/${job.id}`} className="font-semibold hover:text-primary">
                          {job.title}
                        </Link>
                        <div className="mt-1">
                          <JobStatusBadge status={job.status} />
                        </div>
                      </td>
                      <td className="p-3 text-right tabular-nums">{number.format(job.views)}</td>
                      <td className="p-3 text-right tabular-nums">{number.format(job.applications)}</td>
                      <td className="p-3 text-right tabular-nums">{job.views ? percent.format(job.applications / job.views) : "—"}</td>
                      <td className="p-3">{topSource ? `${VIEW_SOURCES[topSource[0]] ?? topSource[0]} (${topSource[1]})` : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {STAGES.filter((s) => job.funnel?.[s])
                          .map((s) => `${APPLICATION_STAGES[s]}: ${job.funnel![s]}`)
                          .join(" · ") || "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">{job.days_to_close != null ? number.format(job.days_to_close) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
