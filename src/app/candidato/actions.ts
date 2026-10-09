"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getJobCatalogs } from "@/lib/catalogs";
import { DISABILITY_CONSENT_VERSION, TALENT_POOL_TERMS_VERSION, WHATSAPP_CONSENT_VERSION } from "@/lib/legal";
import { withinRateLimit } from "@/lib/protection";
import { extractResumeFromPdf, ResumeImportError, resumeImportAvailable } from "@/lib/resume-import";
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

export type PdfImportResult = {
  error?: string;
  data?: {
    headline: string | null;
    objective: string | null;
    areaId: string | null;
    educationLevel: string | null;
    experiences: { company_name: string; role_title: string; started_on: string; ended_on: string; is_current: boolean; activities: string }[];
    education: { course: string; institution: string; level: string; is_course: boolean; started_on: string; ended_on: string; is_current: boolean }[];
    skills: { skill_id: string; tag: string }[];
    languages: { language: string; level: string }[];
  };
};

// Leitura automática do PDF (Claude): devolve sugestões para o formulário; nada é salvo sem revisão.
export async function importResumeFromPdf(): Promise<PdfImportResult> {
  const profile = await requireRole("candidate");
  if (!resumeImportAvailable()) return { error: "Leitura automática indisponível." };
  if (!(await withinRateLimit(`pdf-import:${profile.id}`, 5, 86400))) {
    return { error: "Você já usou a leitura automática várias vezes hoje. Tente amanhã." };
  }

  const supabase = await createClient();
  const { data: resume } = await supabase.from("resumes").select("pdf_path").eq("profile_id", profile.id).maybeSingle();
  if (!resume?.pdf_path) return { error: "Anexe o currículo em PDF primeiro." };
  const { data: file } = await supabase.storage.from("resumes").download(resume.pdf_path);
  if (!file) return { error: "Não foi possível abrir o PDF anexado." };

  const catalogs = await getJobCatalogs();
  try {
    const imported = await extractResumeFromPdf(await file.arrayBuffer(), {
      areas: catalogs.areas.map((a) => a.name),
      skills: catalogs.skills.map((s) => s.name),
    });
    const month = (value: string | null) => (value && /^\d{4}-\d{2}$/.test(value) ? value : "");
    const skillIds = new Map(catalogs.skills.map((s) => [s.name, s.id]));
    return {
      data: {
        headline: imported.headline?.slice(0, 120) ?? null,
        objective: imported.objective?.slice(0, 2000) ?? null,
        areaId: catalogs.areas.find((a) => a.name === imported.area)?.id ?? null,
        educationLevel: imported.education_level,
        experiences: imported.experiences.slice(0, 20).map((e) => ({
          company_name: e.company_name.slice(0, 120),
          role_title: e.role_title.slice(0, 120),
          started_on: month(e.started_on),
          ended_on: e.is_current ? "" : month(e.ended_on),
          is_current: e.is_current,
          activities: (e.activities ?? "").slice(0, 3000),
        })),
        education: imported.education.slice(0, 20).map((e) => ({
          course: e.course.slice(0, 160),
          institution: e.institution.slice(0, 160),
          level: e.level,
          is_course: e.is_course,
          started_on: month(e.started_on),
          ended_on: e.is_current ? "" : month(e.ended_on),
          is_current: e.is_current,
        })),
        skills: imported.skills
          .filter((s) => skillIds.has(s.name))
          .slice(0, 30)
          .map((s) => ({ skill_id: skillIds.get(s.name)!, tag: s.level })),
        languages: imported.languages.slice(0, 10).map((l) => ({ language: l.language.slice(0, 40), level: l.level })),
      },
    };
  } catch (error) {
    if (error instanceof ResumeImportError) return { error: error.message };
    console.error("[leitura de PDF]", error);
    return { error: "Não foi possível ler o PDF agora. Tente novamente." };
  }
}

export async function saveDisability(_: PrivacyState, formData: FormData): Promise<PrivacyState> {
  const profile = await requireRole("candidate");
  if (formData.get("consent") !== "on") return { error: "Para registrar, autorize o uso desta informação." };
  const details = String(formData.get("details") ?? "").trim().slice(0, 500) || null;
  const accommodation = String(formData.get("accommodation") ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  const { data: resume } = await supabase.from("resumes").select("id").eq("profile_id", profile.id).maybeSingle();
  let resumeId = resume?.id;
  if (!resumeId) {
    const { data } = await supabase.from("resumes").insert({ profile_id: profile.id, city_id: profile.city_id }).select("id").single();
    resumeId = data?.id;
  }
  if (!resumeId) return { error: "Não foi possível salvar agora." };

  await supabase.from("resume_disability").delete().eq("resume_id", resumeId);
  const { error } = await supabase.from("resume_disability").insert({
    resume_id: resumeId,
    details,
    needs_accommodation: accommodation,
    consent_version: DISABILITY_CONSENT_VERSION,
  });
  if (error) return { error: "Não foi possível salvar agora." };
  revalidatePath("/candidato", "layout");
  return { message: "Declaração registrada. Ela só é mostrada às empresas de vagas PcD em que você se candidatar." };
}

export async function removeDisability() {
  const profile = await requireRole("candidate");
  const supabase = await createClient();
  const { data: resume } = await supabase.from("resumes").select("id").eq("profile_id", profile.id).maybeSingle();
  if (resume) await supabase.from("resume_disability").delete().eq("resume_id", resume.id);
  revalidatePath("/candidato", "layout");
}

export async function setWhatsApp(_: PrivacyState, formData: FormData): Promise<PrivacyState> {
  await requireRole("candidate");
  const enabled = formData.get("enabled") === "true";
  if (enabled && formData.get("consent") !== "on") return { error: "Para ativar, autorize as mensagens por WhatsApp." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_whatsapp_opt_in", {
    enabled,
    consent_version: enabled ? WHATSAPP_CONSENT_VERSION : null,
  });
  if (error) {
    return { error: error.message.includes("telefone") ? "Cadastre seu WhatsApp com DDD no currículo antes de ativar." : "Não foi possível atualizar agora." };
  }
  revalidatePath("/candidato", "layout");
  return { message: enabled ? "Avisos por WhatsApp ativados." : "Avisos por WhatsApp desativados." };
}
