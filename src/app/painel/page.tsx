import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";

// Ponto de entrada após o login: leva cada perfil à sua área.
export default async function DashboardRedirect() {
  const profile = await requireProfile();
  redirect(ROLE_HOME[profile.role]);
}
