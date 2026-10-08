import { siteUrl, supabaseUrl } from "@/lib/env";

export type ShareSource = "whatsapp" | "linkedin" | "facebook" | "qrcode" | "link" | "empresa";

export function jobPath(slug: string) {
  return `/v/${slug}`;
}

export function companyPath(slug: string) {
  return `/e/${slug}`;
}

// Link público da vaga; a origem alimenta a contagem de visualizações por canal.
export function jobUrl(slug: string, source?: ShareSource) {
  const url = `${siteUrl()}${jobPath(slug)}`;
  return source ? `${url}?origem=${source}` : url;
}

export function companyUrl(slug: string) {
  return `${siteUrl()}${companyPath(slug)}`;
}

export function logoUrl(path: string | null | undefined) {
  return path ? `${supabaseUrl()}/storage/v1/object/public/logos/${path}` : null;
}
