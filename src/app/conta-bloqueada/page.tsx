import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conta bloqueada" };

export default function BlockedAccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-black">Conta bloqueada</h1>
      <Alert variant="destructive">
        Seu acesso ao Trivagas foi bloqueado pela equipe de moderação. Se acredita que houve um engano, fale com o
        suporte.
      </Alert>
      <form action="/auth/sair" method="post">
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </div>
  );
}
