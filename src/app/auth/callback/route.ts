import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

// Retorno do Google, do link mágico e da confirmação de e-mail (fluxo PKCE).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc("touch_last_active");
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/entrar?aviso=link-invalido", origin));
}
