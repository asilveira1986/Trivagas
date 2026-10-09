"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { withinRateLimit } from "@/lib/protection";
import { safeNextPath } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; message?: string; email?: string };

const emailSchema = z.email().trim().toLowerCase();

async function origin() {
  return (await headers()).get("origin") ?? siteUrl();
}

export async function signInWithPassword(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password) {
    return { error: "Informe e-mail e senha.", email: String(formData.get("email") ?? "") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Confirme seu e-mail pelo link que enviamos antes de entrar."
        : "E-mail ou senha incorretos.";
    return { error: message, email: email.data };
  }

  await supabase.rpc("touch_last_active");
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function sendMagicLink(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    return { error: "Informe um e-mail válido.", email: String(formData.get("email") ?? "") };
  }
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!(await withinRateLimit("magic-link", 5, 900))) {
    return { error: "Muitos pedidos de link. Aguarde alguns minutos.", email: email.data };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error?.status === 429) {
    return { error: "Muitas tentativas. Aguarde um minuto e tente novamente.", email: email.data };
  }
  // Demais casos (inclusive e-mail sem conta) recebem a mesma resposta, para não revelar quem tem cadastro.
  return { message: "Se houver uma conta com este e-mail, você receberá um link de acesso em instantes.", email: email.data };
}
