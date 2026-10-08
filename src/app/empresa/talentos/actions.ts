"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireMembership } from "@/lib/company";
import { dispatchNotificationsSafely } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";

export type TalentActionState = { error?: string; message?: string };

const inviteSchema = z.object({
  jobId: z.uuid({ error: "Escolha a vaga" }),
  message: z.string().trim().max(1000, "Use no máximo 1.000 caracteres").optional(),
});

export async function inviteTalent(resumeId: string, _: TalentActionState, formData: FormData): Promise<TalentActionState> {
  const { company } = await requireMembership();
  if (company.status !== "approved") return { error: "O banco de talentos é liberado após a aprovação da empresa." };
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("talent_invites").insert({
    job_id: parsed.data.jobId,
    resume_id: resumeId,
    message: parsed.data.message || null,
  });
  if (error) {
    if (error.code === "23505") return { error: "Este candidato já foi convidado ou já se candidatou a esta vaga." };
    if (error.message.includes("banco de talentos")) return { error: "O candidato saiu do banco de talentos." };
    if (error.message.includes("publicadas")) return { error: "Convites só podem ser enviados para vagas publicadas." };
    return { error: "Não foi possível enviar o convite agora." };
  }

  after(dispatchNotificationsSafely);
  revalidatePath("/empresa/talentos", "layout");
  return { message: "Convite enviado. O contato é liberado quando o candidato aceitar." };
}

export async function saveTalent(formData: FormData) {
  const { company } = await requireMembership();
  const resumeId = String(formData.get("resumeId") ?? "");
  const listName = String(formData.get("listName") ?? "").trim().slice(0, 60) || "Favoritos";
  const supabase = await createClient();
  await supabase.from("saved_resumes").upsert(
    { company_id: company.id, resume_id: resumeId, list_name: listName },
    { onConflict: "company_id,resume_id,list_name", ignoreDuplicates: true },
  );
  revalidatePath("/empresa/talentos", "layout");
}

export async function unsaveTalent(formData: FormData) {
  const { company } = await requireMembership();
  const supabase = await createClient();
  let query = supabase
    .from("saved_resumes")
    .delete()
    .eq("company_id", company.id)
    .eq("resume_id", String(formData.get("resumeId") ?? ""));
  const listName = formData.get("listName");
  if (typeof listName === "string" && listName) query = query.eq("list_name", listName);
  await query;
  revalidatePath("/empresa/talentos", "layout");
}
