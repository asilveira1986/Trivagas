import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="font-heading text-lg font-black">Trivagas</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-white/80">
          <Link href="/termos" className="hover:text-white">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="hover:text-white">
            Política de privacidade
          </Link>
          <Link href="/cadastro?perfil=empresa" className="hover:text-white">
            Para empresas
          </Link>
        </nav>
      </div>
    </footer>
  );
}
