import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/roles";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  "link-invalido": "O link de acesso expirou ou já foi usado. Peça um novo abaixo.",
  "conta-bloqueada": "Sua conta está bloqueada. Fale com o suporte do Trivagas.",
};

export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const notice = typeof params.aviso === "string" ? NOTICES[params.aviso] : undefined;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Entrar no Trivagas</CardTitle>
          <CardDescription>Acesse sua conta de candidato ou de empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} notice={notice} />
        </CardContent>
      </Card>
    </div>
  );
}
