import "server-only";
import { renderEmail } from "@/lib/notifications/templates";
import { dispatchWhatsApp } from "@/lib/notifications/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";

type QueuedNotification = { id: string; template: string; to_address: string; payload: unknown };

export type DispatchResult = { sent: number; failed: number; skipped?: string };

// Envia os e-mails da fila (tabela notifications) pelo Resend.
// Chamado logo após as ações (via after()) e pela rotina agendada como reserva.
export async function dispatchNotifications(batchSize = 50): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const supabase = createAdminClient();
  if (!supabase || !apiKey || !from) {
    return { sent: 0, failed: 0, skipped: "SUPABASE_SECRET_KEY, RESEND_API_KEY ou EMAIL_FROM não configurados" };
  }

  const { data, error } = await supabase.rpc("claim_notifications", { batch_size: batchSize, target_channel: "email" });
  if (error) throw new Error(`Falha ao reservar a fila de e-mails: ${error.message}`);

  let sent = 0;
  let failed = 0;
  for (const notification of (data ?? []) as QueuedNotification[]) {
    const email = renderEmail(notification.template, notification.payload);
    let delivered = false;
    let failure: string | null = null;

    if (!email) {
      failure = `modelo desconhecido: ${notification.template}`;
    } else {
      try {
        const response = await fetch(`${process.env.RESEND_API_URL ?? "https://api.resend.com"}/emails`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            // Reenvio da mesma mensagem não duplica o e-mail.
            "Idempotency-Key": notification.id,
          },
          body: JSON.stringify({ from, to: [notification.to_address], subject: email.subject, html: email.html, text: email.text }),
          signal: AbortSignal.timeout(10_000),
        });
        delivered = response.ok;
        if (!response.ok) failure = `${response.status} ${(await response.text()).slice(0, 500)}`;
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
      }
    }

    await supabase.rpc("finish_notification", { target: notification.id, delivered, failure });
    if (delivered) sent++;
    else failed++;
  }
  return { sent, failed };
}

// Para usar dentro de after(): erros não devem derrubar a resposta ao usuário.
export async function dispatchNotificationsSafely() {
  try {
    await dispatchNotifications();
    await dispatchWhatsApp();
  } catch (err) {
    console.error("[notificações]", err);
  }
}
