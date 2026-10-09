"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { dispatchNotificationsSafely } from "@/lib/notifications/dispatch";
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

  after(dispatchNotificationsSafely);
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

  after(dispatchNotificationsSafely);
  revalidatePath("/admin", "layout");
  redirect(`/admin/empresas?decidida=${parsed.data.status}`);
}

// ---------------------------------------------------------------------------
// Denúncias
// ---------------------------------------------------------------------------
const reportSchema = z
  .object({
    reportId: z.uuid(),
    jobId: z.uuid(),
    intent: z.enum(["takedown", "resolved", "dismissed", "reviewing"], { error: "Escolha uma ação" }),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.intent !== "takedown" || (v.reason?.length ?? 0) >= 5, { message: "Explique à empresa por que a vaga saiu do ar." });

export async function handleReport(_: ModerationState, formData: FormData): Promise<ModerationState> {
  await requireRole("admin");
  const parsed = reportSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { reportId, jobId, intent, reason } = parsed.data;
  const supabase = await createClient();

  if (intent === "takedown") {
    const { error } = await supabase.from("job_moderation").insert({ job_id: jobId, decision: "rejected", reason });
    if (error) return { error: "Não foi possível retirar a vaga do ar." };
    // Todas as denúncias abertas da vaga ficam resolvidas.
    await supabase.from("job_reports").update({ status: "resolved" }).eq("job_id", jobId).in("status", ["open", "reviewing"]);
    after(dispatchNotificationsSafely);
  } else {
    await supabase.from("job_reports").update({ status: intent }).eq("id", reportId);
  }
  revalidatePath("/admin", "layout");
  return {};
}

// ---------------------------------------------------------------------------
// Catálogos e configurações
// ---------------------------------------------------------------------------
export async function addCatalogItem(_: ModerationState, formData: FormData): Promise<ModerationState> {
  await requireRole("admin");
  const table = formData.get("table") === "skills" ? "skills" : "areas";
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: "Informe um nome entre 2 e 80 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).insert({ name });
  if (error) return { error: error.code === "23505" ? "Já existe um item com este nome." : "Não foi possível adicionar." };
  revalidatePath("/admin/catalogos");
  return {};
}

export async function toggleCatalogItem(formData: FormData) {
  await requireRole("admin");
  const table = formData.get("table") === "skills" ? "skills" : "areas";
  const supabase = await createClient();
  await supabase.from(table).update({ active: formData.get("active") === "true" }).eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/catalogos");
}

const settingsSchema = z
  .object({
    required_skills: z.coerce.number().int().min(0).max(100),
    desired_skills: z.coerce.number().int().min(0).max(100),
    area: z.coerce.number().int().min(0).max(100),
    experience: z.coerce.number().int().min(0).max(100),
    education: z.coerce.number().int().min(0).max(100),
    default_radius_km: z.coerce.number().int().min(1, "Raio mínimo de 1 km").max(1000),
    resume_retention_months: z.coerce.number().int().min(2, "Mínimo de 2 meses").max(60),
  })
  .refine((v) => v.required_skills + v.desired_skills + v.area + v.experience + v.education === 100, {
    message: "Os pesos da aderência devem somar 100.",
  });

export async function saveSettings(_: ModerationState & { saved?: boolean }, formData: FormData) {
  await requireRole("admin");
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { default_radius_km, resume_retention_months, ...weights } = parsed.data;
  const supabase = await createClient();
  const results = await Promise.all([
    supabase.from("app_settings").update({ value: weights }).eq("key", "matching_weights"),
    supabase.from("app_settings").update({ value: default_radius_km }).eq("key", "default_radius_km"),
    supabase.from("app_settings").update({ value: resume_retention_months }).eq("key", "resume_retention_months"),
  ]);
  if (results.some((r) => r.error)) return { error: "Não foi possível salvar as configurações." };
  revalidatePath("/admin/catalogos");
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------
export async function setUserBlocked(formData: FormData) {
  const admin = await requireRole("admin");
  const id = String(formData.get("profileId") ?? "");
  if (id === admin.id) return;
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ blocked_at: formData.get("blocked") === "true" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/admin/usuarios");
}
