"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireRole } from "@/lib/auth";
import { APPLICATION_CONSENT_VERSION } from "@/lib/legal";
import { dispatchNotificationsSafely } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";

export type ApplyState = { error?: string };

const KNOWN_ORIGINS = new Set(["whatsapp", "linkedin", "facebook", "qrcode", "link", "empresa"]);

export async function applyToJob(jobId: string, origin: string | null, _: ApplyState, formData: FormData): Promise<ApplyState> {
  await requireRole("candidate");
  if (formData.get("consent") !== "on") {
    return { error: "Para se candidatar, autorize o envio do seu currículo e contato à empresa." };
  }

  const answers = [...formData.entries()]
    .filter(([key]) => key.startsWith("q_"))
    .map(([key, value]) => ({ question_id: key.slice(2), answer: String(value).trim().slice(0, 2000) }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_to_job", {
    target_job: jobId,
    answers,
    origin: origin && KNOWN_ORIGINS.has(origin) ? origin : null,
    consent_version: APPLICATION_CONSENT_VERSION,
  });

  if (error) {
    const message = error.message;
    if (message.startsWith("responda à pergunta") || message.startsWith("resposta inválida")) {
      return { error: message.charAt(0).toUpperCase() + message.slice(1) };
    }
    if (message.includes("já se candidatou")) redirect("/candidato/candidaturas");
    if (message.includes("não está recebendo")) return { error: "Esta vaga não está mais recebendo candidaturas." };
    return { error: "Não foi possível enviar sua candidatura agora. Tente novamente." };
  }

  after(dispatchNotificationsSafely);
  redirect("/candidato/candidaturas?nova=1");
}
