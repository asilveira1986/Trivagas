"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireMembership } from "@/lib/company";
import { dispatchNotificationsSafely } from "@/lib/notifications/dispatch";
import { createClient } from "@/lib/supabase/server";

const stageSchema = z.enum(["new", "reviewing", "interview", "approved", "rejected"]);

export async function updateStage(formData: FormData) {
  await requireMembership();
  const id = String(formData.get("applicationId") ?? "");
  const stage = stageSchema.safeParse(formData.get("stage"));
  if (!stage.success) return;
  const supabase = await createClient();
  await supabase.from("applications").update({ stage: stage.data }).eq("id", id);
  after(dispatchNotificationsSafely);
  revalidatePath("/empresa", "layout");
}

export async function updateRating(formData: FormData) {
  await requireMembership();
  const id = String(formData.get("applicationId") ?? "");
  const value = Number(formData.get("rating"));
  const supabase = await createClient();
  await supabase
    .from("applications")
    .update({ rating: value >= 1 && value <= 5 ? value : null })
    .eq("id", id);
  revalidatePath("/empresa", "layout");
}

export type NoteState = { error?: string; ok?: number };

export async function addNote(applicationId: string, _: NoteState, formData: FormData): Promise<NoteState> {
  await requireMembership();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Escreva a anotação." };
  if (body.length > 5000) return { error: "Use no máximo 5.000 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.from("application_notes").insert({ application_id: applicationId, body });
  if (error) return { error: "Não foi possível salvar a anotação." };
  revalidatePath(`/empresa/candidatos/${applicationId}`);
  return { ok: Date.now() };
}

export async function deleteNote(formData: FormData) {
  await requireMembership();
  const supabase = await createClient();
  await supabase.from("application_notes").delete().eq("id", String(formData.get("noteId") ?? ""));
  revalidatePath(`/empresa/candidatos/${String(formData.get("applicationId") ?? "")}`);
}
