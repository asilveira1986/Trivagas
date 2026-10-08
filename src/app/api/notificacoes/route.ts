import { NextResponse, type NextRequest } from "next/server";
import { dispatchNotifications } from "@/lib/notifications/dispatch";

// Rotina agendada (vercel.json): envia o que ficou na fila, como avisos de encerramento
// gerados pelo pg_cron e reenvios de falhas temporárias.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const result = await dispatchNotifications(200);
  return NextResponse.json(result);
}
