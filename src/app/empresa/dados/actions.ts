"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation/common";
import { companySchema, LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/validation/company";

export type CompanyFormState = { fieldErrors?: FieldErrors; error?: string; saved?: boolean };

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function saveCompany(_: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const membership = await getMyMembership();
  if (membership && membership.role !== "admin") {
    return { error: "Somente administradores da empresa podem alterar os dados." };
  }

  const parsed = companySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const logo = formData.get("logo");
  const hasLogo = logo instanceof File && logo.size > 0;
  if (hasLogo) {
    if (!(LOGO_TYPES as readonly string[]).includes(logo.type)) {
      return { fieldErrors: { logo: ["Envie o logotipo em PNG, JPG ou WebP."] } };
    }
    if (logo.size > LOGO_MAX_BYTES) {
      return { fieldErrors: { logo: ["O logotipo deve ter no máximo 1 MB."] } };
    }
  }

  const input = parsed.data;
  const row = {
    cnpj: input.cnpj,
    legal_name: input.legalName,
    trade_name: input.tradeName,
    segment: input.segment,
    size: input.size,
    postal_code: input.postalCode,
    street: input.street,
    street_number: input.streetNumber,
    complement: input.complement,
    district: input.district,
    city_id: input.cityId,
    phone: input.phone,
    email: input.email,
    website: input.website,
    description: input.description,
  };

  const supabase = await createClient();
  let companyId = membership?.company.id;

  if (companyId) {
    const { error } = await supabase.from("companies").update(row).eq("id", companyId);
    if (error) return { error: describeError(error) };
  } else {
    const { data, error } = await supabase.from("companies").insert(row).select("id").single();
    if (error) return { error: describeError(error) };
    companyId = data.id;
  }

  if (hasLogo && companyId) {
    const path = `${companyId}/logo-${Date.now()}.${EXTENSIONS[logo.type]}`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, logo, { contentType: logo.type, cacheControl: "31536000" });
    if (uploadError) {
      return { error: "Dados salvos, mas não foi possível enviar o logotipo. Tente novamente." };
    }
    await supabase.from("companies").update({ logo_path: path }).eq("id", companyId);
    const previous = membership?.company.logo_path;
    if (previous) await supabase.storage.from("logos").remove([previous]);
  }

  revalidatePath("/empresa", "layout");
  if (!membership) redirect("/empresa?cadastro=enviado");
  return { saved: true };
}

function describeError(error: { code?: string; message: string }) {
  if (error.code === "23505" && error.message.includes("cnpj")) return "Este CNPJ já está cadastrado no Trivagas.";
  if (error.message.includes("já pertence")) return "Seu usuário já pertence a uma empresa.";
  if (error.code === "23514") return "Confira os dados informados.";
  return "Não foi possível salvar agora. Tente novamente.";
}
