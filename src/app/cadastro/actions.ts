"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { signupSchema, type FieldErrors } from "@/lib/validation/auth";

export type SignupState = {
  fieldErrors?: FieldErrors;
  error?: string;
  sentTo?: string;
  values?: Record<string, string>;
};

export async function signUp(_: SignupState, formData: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  // Valores devolvidos ao formulário em caso de erro (nunca a senha).
  const values = { ...raw };
  delete values.password;
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { fieldErrors, values };
  }

  const { email, password, fullName, role, cityId, phone } = parsed.data;
  const origin = (await headers()).get("origin") ?? siteUrl();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/painel`,
      data: {
        full_name: fullName,
        role,
        city_id: cityId,
        phone,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Senha fraca: use letras e números."] }, values };
    }
    if (error.status === 429) {
      return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.", values };
    }
    return { error: "Não foi possível criar a conta agora. Tente novamente.", values };
  }

  // Com confirmação de e-mail desativada, a sessão já vem pronta.
  if (data.session) redirect("/painel");

  return { sentTo: email };
}
