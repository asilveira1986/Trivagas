import "server-only";
import { siteUrl } from "@/lib/env";
import { CANDIDATE_STAGES, type ApplicationStage } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";

type Queued = { id: string; template: string; to_address: string; payload: Record<string, unknown> };

// Modelos de mensagem (templates) que precisam estar aprovados no WhatsApp Business Manager,
// em português (pt_BR), com estas variáveis no corpo, na ordem.
export const WHATSAPP_TEMPLATES: Record<string, { name: string; params: (p: Record<string, unknown>) => string[] }> = {
  application_stage_changed: {
    name: "trivagas_etapa_candidatura",
    // "Olá! Sua candidatura para {{1}} ({{2}}) mudou para: {{3}}. Detalhes: {{4}}"
    params: (p) => [
      String(p.job_title ?? ""),
      String(p.company_name ?? ""),
      CANDIDATE_STAGES[p.stage as ApplicationStage] ?? String(p.stage ?? ""),
      `${siteUrl()}/candidato/candidaturas`,
    ],
  },
  talent_invite: {
    name: "trivagas_convite_vaga",
    // "{{1}} convidou você para a vaga {{2}} no Trivagas. Veja e responda: {{3}}"
    params: (p) => [String(p.company_name ?? ""), String(p.job_title ?? ""), `${siteUrl()}/candidato/candidaturas`],
  },
  job_alert: {
    name: "trivagas_alerta_vagas",
    // "Há {{1}} vaga(s) nova(s) para o seu alerta {{2}}. Confira: {{3}}"
    params: (p) => [String(p.total ?? ""), String(p.alert_name ?? ""), `${siteUrl()}/candidato/alertas`],
  },
};

// Envia a fila de WhatsApp pela API oficial (Cloud API da Meta).
// Sem WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID, as mensagens ficam na fila.
export async function dispatchWhatsApp(batchSize = 50) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
  const admin = createAdminClient();
  if (!admin || !token || !phoneNumberId) return { sent: 0, failed: 0, skipped: "WhatsApp não configurado" };

  const { data, error } = await admin.rpc("claim_notifications", { batch_size: batchSize, target_channel: "whatsapp" });
  if (error) throw new Error(`Falha ao reservar a fila de WhatsApp: ${error.message}`);

  let sent = 0;
  let failed = 0;
  for (const message of (data ?? []) as Queued[]) {
    const template = WHATSAPP_TEMPLATES[message.template];
    let delivered = false;
    let failure: string | null = null;
    if (!template) {
      failure = `modelo sem mensagem de WhatsApp: ${message.template}`;
    } else {
      try {
        const base = process.env.WHATSAPP_API_URL ?? "https://graph.facebook.com";
        const response = await fetch(`${base}/${version}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to_address.replace(/^\+/, ""),
            type: "template",
            template: {
              name: template.name,
              language: { code: "pt_BR" },
              components: [
                {
                  type: "body",
                  parameters: template.params(message.payload).map((text) => ({ type: "text", text: text.slice(0, 900) })),
                },
              ],
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });
        delivered = response.ok;
        if (!response.ok) failure = `${response.status} ${(await response.text()).slice(0, 500)}`;
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
      }
    }
    await admin.rpc("finish_notification", { target: message.id, delivered, failure });
    if (delivered) sent++;
    else failed++;
  }
  return { sent, failed };
}
