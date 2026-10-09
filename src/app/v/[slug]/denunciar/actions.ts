"use server";

import { after } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { dispatchNotificationsSafely } from "@/lib/notifications/dispatch";
import { verifyHuman, withinRateLimit } from "@/lib/protection";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_REASONS } from "./reasons";


export type ReportState = { error?: string; done?: boolean };

const schema = z.object({
  reason: z.enum(REPORT_REASONS, { error: "Escolha o motivo" }),
  details: z.string().trim().max(2000).optional(),
});

export async function reportJob(jobId: string, _: ReportState, formData: FormData): Promise<ReportState> {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await verifyHuman(formData))) return { error: "Confirme que você não é um robô e tente de novo." };
  if (!(await withinRateLimit("report", 5, 3600))) return { error: "Muitas denúncias a partir desta conexão. Tente mais tarde." };

  // Denúncia gravada pelo servidor (a API pública não aceita inserção direta).
  const admin = createAdminClient();
  if (!admin) return { error: "Denúncias indisponíveis no momento. Escreva para o suporte do Trivagas." };

  const { data: job } = await admin.from("jobs").select("id").eq("id", jobId).eq("status", "published").maybeSingle();
  if (!job) return { error: "Esta vaga não está mais publicada." };

  const profile = await getCurrentProfile();
  const { error } = await admin.from("job_reports").insert({
    job_id: jobId,
    reporter_id: profile?.id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  });
  if (error) return { error: "Não foi possível registrar a denúncia agora." };

  after(dispatchNotificationsSafely);
  return { done: true };
}
