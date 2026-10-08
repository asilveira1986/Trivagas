import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const display = Nunito({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Trivagas — vagas de emprego perto de você",
    template: "%s · Trivagas",
  },
  description:
    "Publique vagas, compartilhe o link e receba candidaturas. Candidatos encontram vagas perto de casa em todo o Brasil.",
  applicationName: "Trivagas",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Trivagas",
  },
};

export const viewport: Viewport = {
  themeColor: "#00A651",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
