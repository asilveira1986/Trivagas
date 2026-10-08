"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/company";
import type { JobStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation/common";
import { jobSchema, toSaveJobPayload } from "@/lib/validation/job";

export type JobFormState = { fieldErrors?: FieldErrors; error?: string };

export async function saveJob(jobId: string | null, _: JobFormState, formData: FormData): Promise<JobFormState> {
  const { company } = await requireMembership();
  const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    // Erros de itens das listas aparecem no topo de cada seção.
    for (const key of Object.keys(fieldErrors)) {
      const [list, index] = key.split(".");
      if ((list === "questions" || list === "skills") && index !== undefined) {
        const label = list === "questions" ? `Pergunta ${Number(index) + 1}: ` : "";
        fieldErrors[list] = [...(fieldErrors[list] ?? []), `${label}${fieldErrors[key]![0]}`];
      }
    }
    return { fieldErrors, error: "Confira os campos destacados." };
  }

  const job = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("save_job", {
      target_job: jobId,
      target_company: company.id,
      job: toSaveJobPayload(job),
      skills: job.skills,
      questions: job.questions.map(({ id, question, type, options, is_required }) => ({
        id,
        question,
        type,
        options: type === "single_choice" ? options : [],
        is_required,
      })),
      submit: job.intent === "submit",
    })
    .single<{ job_id: string; job_slug: string; job_status: JobStatus }>();

  if (error || !data) return { error: describeError(error?.message) };

  revalidatePath("/empresa", "layout");
  redirect(`/empresa/vagas/${data.job_id}?salvo=${data.job_status}`);
}

export async function changeJobStatus(formData: FormData) {
  await requireMembership();
  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("status") ?? "") as JobStatus;
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);
  revalidatePath("/empresa", "layout");
  redirect(`/empresa/vagas/${jobId}?${error ? `erro=${encodeURIComponent(describeError(error.message))}` : `salvo=${status}`}`);
}

export async function duplicateJob(formData: FormData) {
  await requireMembership();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_job", { source_job: String(formData.get("jobId") ?? "") });
  if (error || !data) redirect(`/empresa/vagas?erro=${encodeURIComponent("Não foi possível duplicar a vaga.")}`);
  revalidatePath("/empresa", "layout");
  redirect(`/empresa/vagas/${data}/editar?copia=1`);
}

export async function deleteDraft(formData: FormData) {
  await requireMembership();
  const supabase = await createClient();
  await supabase.from("jobs").delete().eq("id", String(formData.get("jobId") ?? "")).eq("status", "draft");
  revalidatePath("/empresa", "layout");
  redirect("/empresa/vagas");
}

function describeError(message = "") {
  if (message.includes("aprovada")) return "A empresa precisa estar aprovada para publicar vagas.";
  if (message.includes("transição")) return "Esta ação não está disponível para a situação atual da vaga.";
  if (message.includes("não encontrada")) return "Vaga não encontrada.";
  return "Não foi possível salvar agora. Tente novamente.";
}
