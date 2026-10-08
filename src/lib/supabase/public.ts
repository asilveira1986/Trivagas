import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

// Cliente sem sessão (papel anon) para páginas públicas e imagens de prévia:
// enxerga apenas o que o RLS libera a visitantes.
export function createPublicClient() {
  return createSupabaseClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
