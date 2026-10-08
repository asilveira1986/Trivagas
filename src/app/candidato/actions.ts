"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { TALENT_POOL_TERMS_VERSION } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
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

export type PrivacyState = { error?: string; message?: string };

export async function setTalentPool(_: PrivacyState, formData: FormData): Promise<PrivacyState> {
  await requireRole("candidate");
  const status = String(formData.get("status") ?? "");
  if (!["active", "paused", "none"].includes(status)) return { error: "Opção inválida." };
  if (status === "active" && formData.get("consent") !== "on" && formData.get("resume") !== "1") {
    return { error: "Para participar, aceite o termo do banco de talentos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_talent_pool", {
    new_status: status,
    consent_version: status === "active" ? TALENT_POOL_TERMS_VERSION : null,
  });
  if (error) return { error: "Não foi possível atualizar agora. Tente novamente." };

  revalidatePath("/candidato", "layout");
  return {
    message:
      status === "active"
        ? "Seu currículo está no banco de talentos. Empresas da sua região podem convidar você."
        : status === "paused"
          ? "Participação pausada: seu currículo não aparece nas buscas até você reativar."
          : "Seu currículo saiu do banco de talentos. As candidaturas que você já enviou continuam valendo.",
  };
}

export async function declineInvite(formData: FormData) {
  await requireRole("candidate");
  const supabase = await createClient();
  await supabase.from("talent_invites").update({ status: "declined" }).eq("id", String(formData.get("inviteId") ?? "")).eq("status", "pending");
  revalidatePath("/candidato", "layout");
}

// Exclusão definitiva da conta (LGPD): remove o PDF e o usuário do Auth; o banco apaga o resto em cascata.
export async function deleteAccount(_: PrivacyState, formData: FormData): Promise<PrivacyState> {
  const profile = await requireRole("candidate");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") {
    return { error: "Digite EXCLUIR para confirmar." };
  }
  const admin = createAdminClient();
  if (!admin) return { error: "Exclusão indisponível no momento. Fale com o suporte do Trivagas." };

  const { data: files } = await admin.storage.from("resumes").list(profile.id);
  if (files?.length) await admin.storage.from("resumes").remove(files.map((file) => `${profile.id}/${file.name}`));

  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) return { error: "Não foi possível excluir a conta agora. Tente novamente." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
