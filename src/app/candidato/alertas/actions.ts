"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { optionalEnum, optionalNumber, optionalText } from "@/lib/validation/common";

export type AlertState = { error?: string; message?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao alerta").max(80),
  q: optionalText(100),
  cidade: optionalNumber(z.number().int().positive()),
  raio: optionalNumber(z.number().int().min(0).max(1000)),
  area: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable().default(null)),
  modalidade: optionalEnum(["on_site", "hybrid", "remote"] as const),
  contrato: optionalEnum(["clt", "pj", "internship", "temporary"] as const),
  afirmativas: z.preprocess((v) => v === "1" || v === "on", z.boolean()).default(false),
  frequencia: z.enum(["daily", "weekly"]).default("daily"),
});

export async function createAlert(_: AlertState, formData: FormData): Promise<AlertState> {
  await requireRole("candidate");
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const a = parsed.data;
  if (!a.q && !a.cidade && !a.area && !a.modalidade && !a.contrato && !a.afirmativas) {
    return { error: "Escolha ao menos um filtro (palavra-chave, cidade, área ou modalidade)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("job_alerts").insert({
    name: a.name,
    query: a.q,
    city_id: a.cidade,
    radius_km: a.raio,
    area_id: a.area,
    work_mode: a.modalidade,
    contract_type: a.contrato,
    affirmative_only: a.afirmativas,
    frequency: a.frequencia,
  });
  if (error) return { error: error.message.includes("limite") ? "Você pode ter até 5 alertas." : "Não foi possível criar o alerta." };
  revalidatePath("/candidato/alertas");
  return { message: "Alerta criado. Avisaremos por e-mail quando surgirem vagas novas." };
}

export async function updateAlert(formData: FormData) {
  await requireRole("candidate");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  if (formData.get("intent") === "delete") await supabase.from("job_alerts").delete().eq("id", id);
  else await supabase.from("job_alerts").update({ active: formData.get("active") === "true" }).eq("id", id);
  revalidatePath("/candidato/alertas");
}
