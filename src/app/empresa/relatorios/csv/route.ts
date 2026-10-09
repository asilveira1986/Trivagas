import { NextResponse, type NextRequest } from "next/server";
import { getMyMembership } from "@/lib/company";
import { APPLICATION_STAGES, JOB_STATUSES, type ApplicationStage } from "@/lib/labels";
import { getCompanyReport, parsePeriod } from "@/lib/reports";

const cell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Relatório por vaga em CSV (separador ";" para abrir direto no Excel em português).
export async function GET(request: NextRequest) {
  const membership = await getMyMembership().catch(() => null);
  if (!membership) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const days = parsePeriod(request.nextUrl.searchParams.get("dias"));
  const report = await getCompanyReport(membership.company.id, days);

  const stages = Object.keys(APPLICATION_STAGES) as ApplicationStage[];
  const header = [
    "Vaga", "Situação", "Publicada em", "Encerrada em", "Visualizações", "Candidaturas", "Conversão (%)", "Dias até fechar",
    ...stages.map((s) => `Funil: ${APPLICATION_STAGES[s]}`),
  ];
  const rows = report.jobs.map((job) => [
    job.title,
    JOB_STATUSES[job.status],
    job.published_at?.slice(0, 10),
    job.closed_at?.slice(0, 10),
    job.views,
    job.applications,
    job.views ? ((job.applications / job.views) * 100).toFixed(1).replace(".", ",") : "",
    job.days_to_close != null ? String(job.days_to_close).replace(".", ",") : "",
    ...stages.map((s) => job.funnel?.[s] ?? 0),
  ]);
  const csv = "﻿" + [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trivagas-relatorio-${days}-dias.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
