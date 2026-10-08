import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: PageProps<"/cadastro">) {
  const { perfil } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription>Rápido: só nome, cidade e contato. O resto você completa depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm initialRole={perfil === "empresa" ? "company" : "candidate"} />
        </CardContent>
      </Card>
    </div>
  );
}
