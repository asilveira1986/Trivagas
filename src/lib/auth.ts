import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type UserRole } from "@/lib/roles";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  city_id: number | null;
  onboarded_at: string | null;
  blocked_at: string | null;
};

// Camada de acesso a dados: lê a sessão validada e o perfil uma vez por requisição.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone, city_id, onboarded_at, blocked_at")
    .eq("id", userId)
    .maybeSingle<Profile>();
  return data ?? null;
});

// Exige usuário logado, com cadastro concluído e não bloqueado.
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");
  if (profile.blocked_at) redirect("/conta-bloqueada");
  if (!profile.onboarded_at) redirect("/boas-vindas");
  return profile;
}

// Exige um dos papéis informados; caso contrário, leva o usuário à própria área.
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(ROLE_HOME[profile.role]);
  return profile;
}
