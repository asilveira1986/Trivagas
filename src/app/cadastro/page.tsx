import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/roles";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: PageProps<"/cadastro">) {
  const { perfil, next } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription>Rápido: só nome, cidade e contato. O resto você completa depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm
            initialRole={perfil === "empresa" ? "company" : "candidate"}
            next={safeNextPath(typeof next === "string" ? next : undefined)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
