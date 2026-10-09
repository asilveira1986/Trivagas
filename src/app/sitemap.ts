import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

// Vagas publicadas e páginas de empresas aprovadas, para o Google encontrar sem custo.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const supabase = createPublicClient();
  const [{ data: jobs }, { data: companies }] = await Promise.all([
    supabase.from("jobs").select("slug, updated_at").eq("status", "published").order("published_at", { ascending: false }).limit(45000),
    supabase.from("companies").select("slug, updated_at").eq("status", "approved").limit(4000),
  ]);

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/vagas`, changeFrequency: "hourly", priority: 0.9 },
    ...(jobs ?? []).map((job) => ({
      url: `${base}/v/${job.slug}`,
      lastModified: job.updated_at,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(companies ?? []).map((company) => ({
      url: `${base}/e/${company.slug}`,
      lastModified: company.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
