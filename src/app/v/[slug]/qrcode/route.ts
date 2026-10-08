import QRCode from "qrcode";
import type { NextRequest } from "next/server";
import { getPublishedJob } from "@/lib/jobs";
import { jobUrl } from "@/lib/links";

// QR Code da vaga para cartazes: PNG em alta resolução (padrão) ou SVG (?formato=svg).
export async function GET(request: NextRequest, { params }: RouteContext<"/v/[slug]/qrcode">) {
  const { slug } = await params;
  const job = await getPublishedJob(slug);
  if (!job) return new Response("Vaga não encontrada", { status: 404 });

  const url = jobUrl(job.slug, "qrcode");
  const options = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#1B2836", light: "#FFFFFF" } };
  const headers = { "Cache-Control": "public, max-age=3600" };

  if (request.nextUrl.searchParams.get("formato") === "svg") {
    const svg = await QRCode.toString(url, { ...options, type: "svg" });
    return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }

  const png = await QRCode.toBuffer(url, { ...options, type: "png", width: 1024 });
  return new Response(new Uint8Array(png), {
    headers: {
      ...headers,
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="vaga-${job.slug}.png"`,
    },
  });
}
