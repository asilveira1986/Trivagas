"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation/common";
import { resumeSchema, toSaveResumeArgs } from "@/lib/validation/resume";

export type ResumeFormState = { fieldErrors?: FieldErrors; error?: string; saved?: boolean };

export async function saveResume(_: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  await requireRole("candidate");
  const parsed = resumeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    for (const key of Object.keys(fieldErrors)) {
      const [list, index] = key.split(".");
      if (["experiences", "education", "languages", "skills"].includes(list) && index !== undefined) {
        fieldErrors[list] = [...(fieldErrors[list] ?? []), `Item ${Number(index) + 1}: ${fieldErrors[key]![0]}`];
      }
    }
    return { fieldErrors, error: "Confira os campos destacados." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_resume", toSaveResumeArgs(parsed.data));
  if (error) return { error: "Não foi possível salvar o currículo agora. Tente novamente." };

  revalidatePath("/candidato", "layout");
  return { saved: true };
}

// O PDF é enviado pelo navegador direto ao Storage (pasta do próprio usuário); aqui só vinculamos ao currículo.
export async function attachResumePdf(path: string): Promise<{ error?: string }> {
  const profile = await requireRole("candidate");
  if (!path.startsWith(`${profile.id}/`) || !path.endsWith(".pdf")) return { error: "Arquivo inválido." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("resumes").select("id, pdf_path").eq("profile_id", profile.id).maybeSingle();

  const { error } = current
    ? await supabase.from("resumes").update({ pdf_path: path }).eq("id", current.id)
    : await supabase.from("resumes").insert({ profile_id: profile.id, city_id: profile.city_id, pdf_path: path });
  if (error) return { error: "Não foi possível anexar o PDF." };

  if (current?.pdf_path && current.pdf_path !== path) {
    await supabase.storage.from("resumes").remove([current.pdf_path]);
  }
  revalidatePath("/candidato", "layout");
  return {};
}

export async function removeResumePdf() {
  const profile = await requireRole("candidate");
  const supabase = await createClient();
  const { data: current } = await supabase.from("resumes").select("id, pdf_path").eq("profile_id", profile.id).maybeSingle();
  if (current?.pdf_path) {
    await supabase.from("resumes").update({ pdf_path: null }).eq("id", current.id);
    await supabase.storage.from("resumes").remove([current.pdf_path]);
  }
  revalidatePath("/candidato", "layout");
}

export async function withdrawApplication(formData: FormData) {
  await requireRole("candidate");
  const supabase = await createClient();
  await supabase.from("applications").delete().eq("id", String(formData.get("applicationId") ?? ""));
  revalidatePath("/candidato", "layout");
  redirect("/candidato/candidaturas?desistencia=1");
}
