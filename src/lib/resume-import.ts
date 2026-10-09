import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { EDUCATION_VALUES } from "@/lib/validation/job";

const LANGUAGE_LEVELS = ["basic", "intermediate", "advanced", "fluent"] as const;
const SKILL_LEVELS = ["basic", "intermediate", "advanced"] as const;

// Formato devolvido ao formulário do currículo (o candidato revisa antes de salvar).
const importedSchema = z.object({
  headline: z.string().nullable(),
  objective: z.string().nullable(),
  area: z.string().nullable(),
  education_level: z.enum(EDUCATION_VALUES).nullable(),
  experiences: z.array(
    z.object({
      company_name: z.string(),
      role_title: z.string(),
      started_on: z.string().nullable(),
      ended_on: z.string().nullable(),
      is_current: z.boolean(),
      activities: z.string().nullable(),
    }),
  ),
  education: z.array(
    z.object({
      course: z.string(),
      institution: z.string(),
      level: z.enum(EDUCATION_VALUES),
      is_course: z.boolean(),
      started_on: z.string().nullable(),
      ended_on: z.string().nullable(),
      is_current: z.boolean(),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), level: z.enum(SKILL_LEVELS) })),
  languages: z.array(z.object({ language: z.string(), level: z.enum(LANGUAGE_LEVELS) })),
});

export type ImportedResume = z.infer<typeof importedSchema>;

const nullableString = { type: ["string", "null"] };
const month = { type: ["string", "null"], description: "Mês e ano no formato AAAA-MM; null se não constar" };

function outputSchema(areas: string[], skills: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["headline", "objective", "area", "education_level", "experiences", "education", "skills", "languages"],
    properties: {
      headline: { ...nullableString, description: "Título profissional curto (até 120 caracteres)" },
      objective: { ...nullableString, description: "Objetivo ou resumo profissional (até 1500 caracteres)" },
      area: { type: ["string", "null"], enum: [...areas, null], description: "Área de atuação principal, do catálogo" },
      education_level: { type: ["string", "null"], enum: [...EDUCATION_VALUES, null], description: "Maior escolaridade concluída ou em curso" },
      experiences: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["company_name", "role_title", "started_on", "ended_on", "is_current", "activities"],
          properties: {
            company_name: { type: "string" },
            role_title: { type: "string" },
            started_on: month,
            ended_on: month,
            is_current: { type: "boolean" },
            activities: nullableString,
          },
        },
      },
      education: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["course", "institution", "level", "is_course", "started_on", "ended_on", "is_current"],
          properties: {
            course: { type: "string" },
            institution: { type: "string" },
            level: { type: "string", enum: [...EDUCATION_VALUES] },
            is_course: { type: "boolean", description: "true para cursos livres ou complementares" },
            started_on: month,
            ended_on: month,
            is_current: { type: "boolean" },
          },
        },
      },
      skills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "level"],
          properties: {
            name: { type: "string", enum: skills },
            level: { type: "string", enum: [...SKILL_LEVELS] },
          },
        },
      },
      languages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["language", "level"],
          properties: { language: { type: "string" }, level: { type: "string", enum: [...LANGUAGE_LEVELS] } },
        },
      },
    },
  };
}

const INSTRUCTIONS = `Você extrai dados de um currículo em PDF para pré-preencher um formulário de currículo de um portal de vagas brasileiro.
- Use somente o que está escrito no documento. Não invente empresas, datas, cursos ou habilidades; use null ou lista vazia quando a informação não aparecer.
- Datas no formato AAAA-MM. Se só houver o ano, use o mês 01. Emprego ou curso atual: is_current = true e ended_on = null.
- Escolaridade: elementary (fundamental), high_school (médio), technical (técnico), undergraduate (superior/graduação), postgraduate (pós/especialização/MBA), masters (mestrado), doctorate (doutorado).
- Habilidades e área: escolha apenas itens das listas permitidas que estejam claramente evidenciados no currículo.
- Não extraia dados pessoais sensíveis (CPF, RG, data de nascimento, estado civil, religião, foto, saúde). Escreva os textos em português.`;

export function resumeImportAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class ResumeImportError extends Error {}

// Lê o PDF do currículo com o Claude e devolve uma sugestão estruturada para o candidato revisar.
export async function extractResumeFromPdf(pdf: ArrayBuffer, catalogs: { areas: string[]; skills: string[] }) {
  const client = new Anthropic();
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Se a solicitação for recusada pelos filtros de segurança, o servidor tenta o modelo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: outputSchema(catalogs.areas, catalogs.skills) },
      },
      system: INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pdf).toString("base64") },
            },
            { type: "text", text: "Extraia os dados deste currículo." },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new ResumeImportError("Muitas leituras agora. Tente em alguns minutos.");
    if (error instanceof Anthropic.BadRequestError) throw new ResumeImportError("Não foi possível ler este PDF. Confira se o arquivo abre normalmente.");
    if (error instanceof Anthropic.APIError) throw new ResumeImportError("Leitura automática indisponível no momento.");
    throw error;
  }

  if (response.stop_reason === "refusal") throw new ResumeImportError("Não foi possível ler este currículo automaticamente.");
  if (response.stop_reason === "max_tokens") throw new ResumeImportError("O currículo é longo demais para a leitura automática.");

  const text = response.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")?.text;
  let json: unknown;
  try {
    json = JSON.parse(text ?? "");
  } catch {
    throw new ResumeImportError("Não foi possível interpretar o currículo.");
  }
  const parsed = importedSchema.safeParse(json);
  if (!parsed.success) throw new ResumeImportError("Não foi possível interpretar o currículo.");
  return parsed.data;
}
