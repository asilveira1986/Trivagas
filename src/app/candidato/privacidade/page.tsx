import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { TALENT_POOL_STATUSES } from "@/lib/labels";
import { getMyResume } from "@/lib/resume";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { DeleteAccountForm, DisabilityForm, TalentPoolForm, WhatsAppForm } from "./privacy-forms";

export const metadata: Metadata = { title: "Privacidade" };

const PURPOSES: Record<string, string> = {
  terms_of_use: "Termos de uso",
  privacy_policy: "Política de privacidade",
  application: "Envio de currículo em candidatura",
  talent_pool: "Banco de talentos",
  disability_data: "Declaração de deficiência",
  whatsapp: "Avisos por WhatsApp",
};

export default async function PrivacyPage() {
  const profile = await requireRole("candidate");
  const supabase = await createClient();
  const [resume, { data: consents }, { data: me }, { data: disability }] = await Promise.all([
    getMyResume(),
    supabase.from("consents").select("purpose, granted, term_version, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("profiles").select("whatsapp_opt_in").eq("id", profile.id).single(),
    supabase.from("resume_disability").select("details, needs_accommodation").maybeSingle(),
  ]);
  const status = resume?.talent_pool_status ?? "none";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Privacidade e dados" />

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">Banco de talentos</h2>
          <Badge variant={status === "active" ? "success" : status === "paused" ? "warning" : "default"}>
            {TALENT_POOL_STATUSES[status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          No banco de talentos, empresas da sua região encontram seu perfil profissional e podem convidar você para vagas, mesmo
          sem você se candidatar. Sem autorização, seu currículo só é visto pelas empresas das vagas em que você se candidatou.
        </p>
        <TalentPoolForm status={status} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Avisos por WhatsApp</h2>
        <p className="text-sm text-muted-foreground">Além do e-mail, receba no WhatsApp os avisos mais importantes.</p>
        <WhatsAppForm enabled={Boolean(me?.whatsapp_opt_in)} hasPhone={Boolean(profile.phone)} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Declaração de deficiência (opcional)</h2>
        <p className="text-sm text-muted-foreground">
          Se você é uma pessoa com deficiência, pode declarar para participar de vagas PcD. A declaração é voluntária e só aparece
          para empresas de vagas PcD em que você se candidatar — nunca na busca do banco de talentos.
        </p>
        <DisabilityForm current={disability ?? null} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Seus dados</h2>
        <p className="text-sm text-muted-foreground">
          Baixe uma cópia de tudo o que o Trivagas guarda sobre você: perfil, currículo, candidaturas, convites e consentimentos.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <a href="/candidato/meus-dados" download>
            <Download /> Baixar meus dados
          </a>
        </Button>
        {consents && consents.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-primary">Histórico de consentimentos</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {consents.map((consent, index) => (
                <li key={index}>
                  {PURPOSES[consent.purpose] ?? consent.purpose}: {consent.granted ? "autorizado" : "retirado"} em{" "}
                  {formatDateTime(consent.created_at)} (versão {consent.term_version})
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-5">
        <h2 className="text-lg font-extrabold text-destructive">Excluir conta</h2>
        <p className="text-sm text-muted-foreground">
          Apaga definitivamente sua conta, currículo, PDF e candidaturas. As empresas deixam de ver seus dados. Esta ação não pode
          ser desfeita.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
