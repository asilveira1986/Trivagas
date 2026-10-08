function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada. Veja .env.example.`);
  }
  return value;
}

// Acesso explícito a process.env.NEXT_PUBLIC_* para o Next.js embutir os valores no navegador.
export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabasePublishableKey = () =>
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
