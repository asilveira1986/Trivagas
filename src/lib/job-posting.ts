import type { JobDetail } from "@/lib/jobs";
import { companyUrl, jobUrl, logoUrl } from "@/lib/links";

const EMPLOYMENT_TYPES = {
  clt: "FULL_TIME",
  pj: "CONTRACTOR",
  internship: "INTERN",
  temporary: "TEMPORARY",
} as const;

// Dados estruturados schema.org/JobPosting (Google for Jobs).
export function jobPostingJsonLd(job: JobDetail) {
  const company = job.companies;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.replace(/\n/g, "<br>"),
    identifier: { "@type": "PropertyValue", name: company?.trade_name, value: job.id },
    datePosted: job.published_at ?? job.created_at,
    employmentType: EMPLOYMENT_TYPES[job.contract_type],
    totalJobOpenings: job.positions,
    directApply: true,
    url: jobUrl(job.slug),
    hiringOrganization: {
      "@type": "Organization",
      name: company?.trade_name,
      sameAs: company?.slug ? companyUrl(company.slug) : undefined,
      logo: logoUrl(company?.logo_path) ?? undefined,
    },
  };

  if (job.closes_at) data.validThrough = `${job.closes_at}T23:59:59-03:00`;

  if (job.work_mode === "remote") {
    data.jobLocationType = "TELECOMMUTE";
    data.applicantLocationRequirements = { "@type": "Country", name: "Brasil" };
  } else if (job.cities) {
    data.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.cities.name,
        addressRegion: job.cities.states?.uf,
        addressCountry: "BR",
      },
    };
  }

  if (job.salary_min != null || job.salary_max != null) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "BRL",
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salary_min ?? undefined,
        maxValue: job.salary_max ?? undefined,
        value: job.salary_min === job.salary_max ? job.salary_min : undefined,
        unitText: "MONTH",
      },
    };
  }

  // Evita fechar a tag <script> por engano dentro do texto da vaga.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
