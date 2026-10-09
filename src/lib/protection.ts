import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "desconhecido";
}

// Verificação anti-robô (Cloudflare Turnstile). Sem TURNSTILE_SECRET_KEY configurada, não bloqueia
// (ambiente de desenvolvimento); em produção a chave deve estar definida.
export async function verifyHuman(formData: FormData) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: await clientIp() }),
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

// Limite de tentativas por chave (ex.: "signup:<ip>") numa janela de tempo, guardado no banco.
export async function withinRateLimit(bucket: string, maxHits: number, windowSeconds: number) {
  const admin = createAdminClient();
  if (!admin) return true;
  const { data, error } = await admin.rpc("hit_rate_limit", {
    bucket_key: `${bucket}:${await clientIp()}`,
    max_hits: maxHits,
    window_seconds: windowSeconds,
  });
  return error ? true : data !== false;
}
