import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JobNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <SearchX className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-black">Vaga indisponível</h1>
      <p className="text-muted-foreground">
        Esta vaga foi encerrada, está pausada ou o link está incorreto. Crie sua conta para ser avisado de novas vagas
        perto de você.
      </p>
      <Button asChild>
        <Link href="/cadastro?perfil=candidato">Criar conta de candidato</Link>
      </Button>
    </div>
  );
}
