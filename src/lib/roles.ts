export type UserRole = "candidate" | "company" | "admin";

export const ROLE_LABELS: Record<UserRole, string> = {
  candidate: "Candidato",
  company: "Empresa",
  admin: "Administrador",
};

export const ROLE_HOME: Record<UserRole, string> = {
  candidate: "/candidato",
  company: "/empresa",
  admin: "/admin",
};

// Aceita apenas caminhos internos, para evitar redirecionamento aberto.
export function safeNextPath(value: string | null | undefined, fallback = "/painel"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
