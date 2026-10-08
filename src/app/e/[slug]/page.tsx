import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Building2, Globe, MapPin } from "lucide-react";
import { ShareButtons } from "@/components/jobs/share-buttons";
import { cityLabel } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { locationLabel } from "@/lib/jobs";
import { CONTRACT_TYPES, type ContractType, type WorkMode } from "@/lib/labels";
import { companyPath, companyUrl, jobPath, logoUrl } from "@/lib/links";
import { createPublicClient } from "@/lib/supabase/public";

type PublicCompany = {
  id: string;
  slug: string;
  trade_name: string;
  segment: string | null;
  description: string | null;
  website: string | null;
  logo_path: string | null;
  cities: { name: string; states: { uf: string } | null } | null;
  jobs: {
    id: string;
    slug: string;
    title: string;
    status: string;
    contract_type: ContractType;
    work_mode: WorkMode;
    published_at: string | null;
    cities: { name: string; states: { uf: string } | null } | null;
  }[];
};

const getCompany = cache(async (slug: string) => {
  const { data } = await createPublicClient()
    .from("companies")
    .select(
      "id, slug, trade_name, segment, description, website, logo_path, cities(name, states(uf)), jobs(id, slug, title, status, contract_type, work_mode, published_at, cities(name, states(uf)))",
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .eq("jobs.status", "published")
    .order("published_at", { referencedTable: "jobs", ascending: false })
    .maybeSingle<PublicCompany>();
  return data;
});

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) return { title: "Empresa não encontrada", robots: { index: false } };
  const title = `Vagas na ${company.trade_name}`;
  const description = `${company.jobs.length} vaga(s) aberta(s). ${company.description ?? ""}`.slice(0, 200);
  const logo = logoUrl(company.logo_path);
  return {
    title,
    description,
    alternates: { canonical: companyPath(company.slug) },
    openGraph: { title, description, url: companyPath(company.slug), images: logo ? [{ url: logo }] : undefined },
  };
}

export default async function PublicCompanyPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();
  const logo = logoUrl(company.logo_path);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-start gap-4">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
          {logo ? (
            <Image src={logo} alt="" width={80} height={80} className="size-full object-contain" unoptimized />
          ) : (
            <Building2 className="size-8 text-muted-foreground" />
          )}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black leading-tight">{company.trade_name}</h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {company.segment && <span>{company.segment}</span>}
            {company.cities && (
              <span className="flex items-center gap-1">
                <MapPin className="size-4" /> {cityLabel(company.cities)}
              </span>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 hover:text-primary">
                <Globe className="size-4" /> Site
              </a>
            )}
          </p>
        </div>
      </header>

      {company.description && <p className="whitespace-pre-line leading-relaxed">{company.description}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Vagas abertas ({company.jobs.length})</h2>
        {company.jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            Nenhuma vaga aberta no momento.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {company.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`${jobPath(job.slug)}?origem=empresa`}
                  className="flex flex-col gap-1 rounded-xl border p-4 transition-colors hover:border-primary"
                >
                  <span className="text-lg font-extrabold">{job.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {locationLabel(job)} · {CONTRACT_TYPES[job.contract_type]} · publicada em {formatDate(job.published_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Compartilhe as vagas da empresa</h2>
        <ShareButtons url={companyUrl(company.slug)} text={`Vagas abertas na ${company.trade_name}`} />
      </section>
    </div>
  );
}
