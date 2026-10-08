import { ImageResponse } from "next/og";
import { getPublishedJob, locationLabel } from "@/lib/jobs";
import { CONTRACT_TYPES, WORK_MODES } from "@/lib/labels";
import { logoUrl } from "@/lib/links";

export const alt = "Vaga no Trivagas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#00A651";
const RED = "#E31B23";
const YELLOW = "#FFCB05";
const NAVY = "#1B2836";

// Nunito recortada só com os caracteres usados (API do Google Fonts); sem rede, usa a fonte padrão.
async function loadFont(text: string, weight: number) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Nunito:wght@${weight}&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(3000) },
    ).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { signal: AbortSignal.timeout(3000) }).then((response) => response.arrayBuffer());
  } catch {
    return null;
  }
}

// Símbolo "T" em faixas, também usado quando a empresa não tem logotipo.
function Mark({ scale = 1 }: { scale?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 112 * scale }}>
      <div style={{ width: 112 * scale, height: 24 * scale, background: GREEN, borderRadius: 8 * scale }} />
      <div style={{ width: 112 * scale, height: 20 * scale, background: RED, borderRadius: 8 * scale, marginTop: 6 * scale }} />
      <div style={{ width: 32 * scale, height: 52 * scale, background: YELLOW, borderRadius: 8 * scale, marginTop: 6 * scale }} />
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getPublishedJob(slug);

  if (!job) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "white", gap: 32 }}>
          <Mark scale={1.5} />
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: NAVY }}>TRIVagas</div>
        </div>
      ),
      size,
    );
  }

  // O gerador de imagens não lê WebP: nesse caso usa o símbolo do Trivagas.
  const logo = job.companies?.logo_path && !job.companies.logo_path.endsWith(".webp") ? logoUrl(job.companies.logo_path) : null;
  const title = job.title.length > 70 ? `${job.title.slice(0, 67)}…` : job.title;
  const details = `${locationLabel(job)} · ${CONTRACT_TYPES[job.contract_type]} · ${WORK_MODES[job.work_mode]}`;
  const company = job.companies?.trade_name ?? "";
  const [bold, regular] = await Promise.all([
    loadFont(`${title}${company}Candidate-se`, 800),
    loadFont(details, 600),
  ]);
  const fonts = [
    ...(bold ? [{ name: "Nunito", data: bold, weight: 800 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Nunito", data: regular, weight: 600 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "white", fontFamily: fonts.length ? "Nunito" : "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 24 }}>
          <div style={{ flex: 1, background: GREEN }} />
          <div style={{ flex: 1, background: RED }} />
          <div style={{ flex: 1, background: YELLOW }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 64px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div
              style={{
                display: "flex",
                width: 128,
                height: 128,
                borderRadius: 24,
                border: "2px solid #DFE4EA",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "white",
              }}
            >
              {logo ? (
                <img src={logo} alt="" width={120} height={120} style={{ objectFit: "contain" }} />
              ) : (
                <Mark scale={0.8} />
              )}
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#5B6775" }}>{company}</div>
          </div>

          <div style={{ display: "flex", fontSize: title.length > 40 ? 64 : 80, fontWeight: 800, color: NAVY, lineHeight: 1.1 }}>
            {title}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: NAVY }}>{details}</div>
            <div style={{ display: "flex", background: GREEN, color: "white", fontSize: 32, fontWeight: 800, padding: "14px 28px", borderRadius: 16 }}>
              Candidate-se
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
