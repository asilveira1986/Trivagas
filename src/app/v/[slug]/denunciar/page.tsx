import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedJob } from "@/lib/jobs";
import { jobPath } from "@/lib/links";
import { reportJob } from "./actions";
import { REPORT_REASONS } from "./reasons";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Denunciar vaga", robots: { index: false } };

export default async function ReportJobPage({ params }: PageProps<"/v/[slug]/denunciar">) {
  const { slug } = await params;
  const job = await getPublishedJob(slug);
  if (!job) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-10">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted-foreground">Denunciar vaga</p>
        <h1 className="text-2xl font-black leading-tight">{job.title}</h1>
        <p className="text-sm text-muted-foreground">{job.companies?.trade_name}</p>
      </div>
      <ReportForm action={reportJob.bind(null, job.id)} reasons={REPORT_REASONS} />
      <Link href={jobPath(job.slug)} className="text-sm font-semibold text-primary hover:underline">
        ← Voltar para a vaga
      </Link>
    </div>
  );
}
