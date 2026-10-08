"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ModerationState = { error?: string };

const moderationSchema = z
  .object({
    decision: z.enum(["approved", "rejected", "changes_requested"], { error: "Escolha uma decisão" }),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.decision === "approved" || (value.reason?.length ?? 0) >= 5, {
    message: "Explique o motivo para a empresa (mínimo de 5 caracteres).",
  });

export async function moderateJob(jobId: string, _: ModerationState, formData: FormData): Promise<ModerationState> {
  await requireRole("admin");
  const parsed = moderationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("job_moderation").insert({
    job_id: jobId,
    decision: parsed.data.decision,
    reason: parsed.data.reason || null,
  });
  if (error) {
    return {
      error: error.message.includes("aprovada")
        ? "A empresa ainda não foi aprovada: aprove o cadastro da empresa antes de publicar a vaga."
        : "Não foi possível registrar a decisão.",
    };
  }

  revalidatePath("/admin", "layout");
  redirect(`/admin/vagas?decidida=${parsed.data.decision}`);
}

const companySchema = z
  .object({
    status: z.enum(["approved", "rejected", "blocked"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.status === "approved" || (value.reason?.length ?? 0) >= 5, {
    message: "Explique o motivo para a empresa (mínimo de 5 caracteres).",
  });

export async function reviewCompany(companyId: string, _: ModerationState, formData: FormData): Promise<ModerationState> {
  await requireRole("admin");
  const parsed = companySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ status: parsed.data.status, status_reason: parsed.data.status === "approved" ? null : parsed.data.reason })
    .eq("id", companyId);
  if (error) return { error: "Não foi possível salvar a decisão." };

  revalidatePath("/admin", "layout");
  redirect(`/admin/empresas?decidida=${parsed.data.status}`);
}
