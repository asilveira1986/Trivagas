import { NextResponse, type NextRequest } from "next/server";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { dispatchWhatsApp } from "@/lib/notifications/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";

// Rotina agendada (vercel.json): gera os alertas de vagas do dia e envia o que ficou na fila
// (e-mail e WhatsApp), como avisos de encerramento gerados pelo pg_cron e reenvios de falhas.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  // Alertas de vagas do dia entram na fila antes do envio.
  const admin = createAdminClient();
  const alerts = admin ? await admin.rpc("queue_job_alerts") : null;
  const emails = await dispatchNotifications(200);
  const whatsapp = await dispatchWhatsApp(200);
  return NextResponse.json({ alerts: alerts?.data ?? null, emails, whatsapp });
}
