import Link from "next/link";
import { TrivagasLogo } from "@/components/brand/trivagas-mark";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Trivagas — página inicial">
          <TrivagasLogo />
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/vagas">Vagas</Link>
          </Button>
          {profile ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/painel">Painel</Link>
              </Button>
              <form action="/auth/sair" method="post">
                <Button type="submit" variant="outline" size="sm">
                  Sair
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/cadastro?perfil=empresa">Anunciar vaga</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/entrar">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/cadastro">Criar conta</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
