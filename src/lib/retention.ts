import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RetentionResult = { warned: number; deleted: number; failed: number; skipped?: string };

// LGPD: avisa candidatos inativos há (prazo - 1) meses e, sem retorno em 25 dias após o aviso,
// remove definitivamente a conta (PDF no Storage + usuário do Auth; o banco apaga o resto em cascata).
export async function runRetention(): Promise<RetentionResult> {
  const admin = createAdminClient();
  if (!admin) return { warned: 0, deleted: 0, failed: 0, skipped: "SUPABASE_SECRET_KEY não configurada" };

  const { data, error } = await admin.rpc("retention_candidates");
  if (error) throw new Error(`Falha ao listar candidatos inativos: ${error.message}`);
  const rows = (data ?? []) as { profile_id: string; action: "warn" | "delete" }[];

  const toWarn = rows.filter((r) => r.action === "warn").map((r) => r.profile_id);
  let warned = 0;
  if (toWarn.length) {
    const { data: count } = await admin.rpc("mark_inactivity_warned", { targets: toWarn });
    warned = Number(count ?? 0);
  }

  let deleted = 0;
  let failed = 0;
  for (const { profile_id } of rows.filter((r) => r.action === "delete")) {
    const { data: files } = await admin.storage.from("resumes").list(profile_id);
    if (files?.length) await admin.storage.from("resumes").remove(files.map((f) => `${profile_id}/${f.name}`));
    const { error: deleteError } = await admin.auth.admin.deleteUser(profile_id);
    if (deleteError) failed++;
    else deleted++;
  }
  return { warned, deleted, failed };
}
