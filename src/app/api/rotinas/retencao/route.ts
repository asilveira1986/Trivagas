import { NextResponse, type NextRequest } from "next/server";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { runRetention } from "@/lib/retention";

// Rotina diária (vercel.json): retenção de currículos inativos (aviso e remoção definitiva).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const retention = await runRetention();
  const emails = await dispatchNotifications(200);
  return NextResponse.json({ retention, emails });
}
