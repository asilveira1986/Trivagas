import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Send } from "lucide-react";
import { JobBody, JobFacts, JobHeader } from "@/components/jobs/job-details";
import { ShareButtons } from "@/components/jobs/share-buttons";
import { ViewTracker } from "@/components/jobs/view-tracker";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { jobPostingJsonLd } from "@/lib/job-posting";
import { getPublishedJob, locationLabel } from "@/lib/jobs";
import { CONTRACT_TYPES } from "@/lib/labels";
import { companyPath, jobPath, jobUrl } from "@/lib/links";

export async function generateMetadata({ params }: PageProps<"/v/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const job = await getPublishedJob(slug);
  if (!job) return { title: "Vaga não encontrada", robots: { index: false } };

  const company = job.companies?.trade_name ?? "";
  const title = `${job.title} – ${company}`;
  const description = `${CONTRACT_TYPES[job.contract_type]} · ${locationLabel(job)}. ${job.description}`.replace(/\s+/g, " ").slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: jobPath(job.slug) },
    openGraph: { type: "website", title, description, url: jobPath(job.slug), siteName: "Trivagas", locale: "pt_BR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicJobPage({ params, searchParams }: PageProps<"/v/[slug]">) {
  const [{ slug }, { origem }] = await Promise.all([params, searchParams]);
  const job = await getPublishedJob(slug);
  if (!job) notFound();
  const company = job.companies;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobPostingJsonLd(job) }} />
      <ViewTracker jobId={job.id} source={typeof origem === "string" ? origem : undefined} />

      <JobHeader job={job} />
      <JobFacts job={job} />

      <div className="flex flex-col gap-3 rounded-xl bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold">
          Publicada em {formatDate(job.published_at)}
          {job.closes_at && ` · inscrições até ${formatDate(job.closes_at)}`}
        </p>
        <Button asChild size="lg">
          <Link href={`${jobPath(job.slug)}/candidatar${typeof origem === "string" ? `?origem=${encodeURIComponent(origem)}` : ""}`}>
            <Send /> Quero me candidatar
          </Link>
        </Button>
      </div>

      <JobBody job={job} />

      {company && (
        <section className="flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Building2 className="size-5 text-primary" /> {company.trade_name}
          </h2>
          {company.description && <p className="line-clamp-4 whitespace-pre-line text-sm">{company.description}</p>}
          <Link href={companyPath(company.slug)} className="text-sm font-semibold text-primary hover:underline">
            Ver todas as vagas da empresa
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Conhece alguém para esta vaga? Compartilhe</h2>
        <ShareButtons url={jobUrl(job.slug)} text={`Vaga: ${job.title} – ${company?.trade_name ?? ""}`} />
      </section>
    </article>
  );
}
