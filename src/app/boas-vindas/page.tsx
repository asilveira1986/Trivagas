import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Boas-vindas" };

export default async function OnboardingPage({ searchParams }: PageProps<"/boas-vindas">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");
  if (profile.onboarded_at) redirect("/painel");
  const { perfil } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Boas-vindas ao Trivagas!</CardTitle>
          <CardDescription>Falta pouco: conte como você vai usar o portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm initialRole={perfil === "empresa" ? "company" : "candidate"} defaultName={profile.full_name} />
        </CardContent>
      </Card>
    </div>
  );
}
