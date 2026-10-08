"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMembership } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

export type MemberActionState = { error?: string; message?: string };

const addSchema = z.object({
  email: z.email("Informe um e-mail válido").trim().toLowerCase(),
  role: z.enum(["admin", "recruiter"]),
});

export async function addMember(_: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const { company, role } = await requireMembership();
  if (role !== "admin") return { error: "Somente administradores podem adicionar usuários." };

  const parsed = addSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_company_member", {
    target_company: company.id,
    member_email: parsed.data.email,
    member_role: parsed.data.role,
  });
  if (error) {
    if (error.message.includes("nenhuma conta")) {
      return {
        error:
          "Não há conta de empresa com este e-mail. Peça para a pessoa criar a conta em “Criar conta → Sou empresa” e tente de novo.",
      };
    }
    if (error.message.includes("já pertence")) return { error: "Este usuário já pertence a uma empresa." };
    return { error: "Não foi possível adicionar agora. Tente novamente." };
  }

  revalidatePath("/empresa/usuarios");
  return { message: "Usuário adicionado." };
}

export async function updateMember(formData: FormData) {
  const { company, role } = await requireMembership();
  if (role !== "admin") return;
  const profileId = String(formData.get("profileId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const supabase = await createClient();

  if (intent === "remove") {
    await supabase.from("company_members").delete().eq("company_id", company.id).eq("profile_id", profileId);
  } else if (intent === "admin" || intent === "recruiter") {
    await supabase.from("company_members").update({ role: intent }).eq("company_id", company.id).eq("profile_id", profileId);
  }
  revalidatePath("/empresa/usuarios");
}
