import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/vagas", "/v/", "/e/"],
      disallow: ["/painel", "/candidato", "/empresa", "/admin", "/auth", "/boas-vindas", "/api", "/v/*/candidatar", "/v/*/denunciar"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
