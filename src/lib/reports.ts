import "server-only";
import type { ApplicationStage, JobStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export type JobReport = {
  id: string;
  title: string;
  status: JobStatus;
  published_at: string | null;
  closed_at: string | null;
  days_to_close: number | null;
  views: number;
  applications: number;
  views_by_source: Record<string, number> | null;
  applications_by_source: Record<string, number> | null;
  funnel: Partial<Record<ApplicationStage, number>> | null;
};

export const REPORT_PERIODS = [30, 90, 365] as const;

export async function getCompanyReport(companyId: string, days: number) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("company_report", { target_company: companyId, period_days: days });
  const jobs = ((data as { jobs?: JobReport[] } | null)?.jobs ?? []) as JobReport[];

  const totalViews = jobs.reduce((sum, j) => sum + j.views, 0);
  const totalApplications = jobs.reduce((sum, j) => sum + j.applications, 0);
  const closed = jobs.filter((j) => j.days_to_close != null);
  const bySource = new Map<string, number>();
  for (const job of jobs) for (const [source, total] of Object.entries(job.views_by_source ?? {})) bySource.set(source, (bySource.get(source) ?? 0) + total);

  return {
    jobs,
    totals: {
      views: totalViews,
      applications: totalApplications,
      conversion: totalViews ? totalApplications / totalViews : null,
      avgDaysToClose: closed.length ? closed.reduce((s, j) => s + (j.days_to_close ?? 0), 0) / closed.length : null,
    },
    viewsBySource: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export function parsePeriod(value: unknown) {
  const days = Number(value);
  return (REPORT_PERIODS as readonly number[]).includes(days) ? days : 30;
}
