"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TalentPoolStatus } from "@/lib/labels";
import { deleteAccount, removeDisability, saveDisability, setTalentPool, setWhatsApp, type PrivacyState } from "../actions";

export function TalentPoolForm({ status }: { status: TalentPoolStatus }) {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(setTalentPool, {});

  return (
    <div className="flex flex-col gap-3">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}

      {status === "none" && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="status" value="active" />
          <label className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
            <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-primary" />
            <span>
              Autorizo que empresas aprovadas no Trivagas encontrem meu perfil profissional (sem telefone, e-mail e PDF) e me
              enviem convites para vagas. Meus contatos só são enviados a uma empresa se eu aceitar o convite. Posso pausar ou
              retirar a autorização quando quiser, conforme a{" "}
              <Link href="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">
                política de privacidade
              </Link>
              .
            </span>
          </label>
          <Button type="submit" disabled={pending} className="w-fit">
            Participar do banco de talentos
          </Button>
        </form>
      )}

      {status !== "none" && (
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            <input type="hidden" name="status" value={status === "active" ? "paused" : "active"} />
            <input type="hidden" name="resume" value="1" />
            <Button type="submit" variant={status === "paused" ? "default" : "outline"} disabled={pending}>
              {status === "active" ? "Pausar participação" : "Reativar participação"}
            </Button>
          </form>
          <form action={action}>
            <input type="hidden" name="status" value="none" />
            <Button type="submit" variant="ghost" className="text-destructive" disabled={pending}>
              Retirar meu currículo do banco
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Para confirmar, digite EXCLUIR
        <Input name="confirm" autoComplete="off" className="max-w-48" />
      </label>
      <Button type="submit" variant="destructive" disabled={pending} className="w-fit">
        Excluir minha conta definitivamente
      </Button>
    </form>
  );
}

export function WhatsAppForm({ enabled, hasPhone }: { enabled: boolean; hasPhone: boolean }) {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(setWhatsApp, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}
      <input type="hidden" name="enabled" value={String(!enabled)} />
      {!enabled && (
        <label className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-primary" disabled={!hasPhone} />
          <span>
            Autorizo o Trivagas a enviar para o meu WhatsApp avisos de entrevista, resultado de candidatura, convites de empresas e
            alertas de vagas. Posso desativar quando quiser.
          </span>
        </label>
      )}
      <Button type="submit" variant={enabled ? "outline" : "default"} disabled={pending || (!enabled && !hasPhone)} className="w-fit">
        {enabled ? "Desativar avisos por WhatsApp" : "Ativar avisos por WhatsApp"}
      </Button>
      {!hasPhone && <p className="text-xs text-muted-foreground">Cadastre seu WhatsApp com DDD em “Meu currículo” para ativar.</p>}
    </form>
  );
}

export function DisabilityForm({ current }: { current: { details: string | null; needs_accommodation: string | null } | null }) {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(saveDisability, {});
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        {state.error && <Alert variant="destructive">{state.error}</Alert>}
        {state.message && <Alert variant="success">{state.message}</Alert>}
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Deficiência (como você prefere descrever)
          <Input name="details" maxLength={500} defaultValue={current?.details ?? ""} placeholder="Ex.: deficiência auditiva" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Adaptações que facilitam seu trabalho ou a entrevista (opcional)
          <Input
            name="accommodation"
            maxLength={500}
            defaultValue={current?.needs_accommodation ?? ""}
            placeholder="Ex.: intérprete de Libras, acesso sem escadas"
          />
        </label>
        <label className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-primary" />
          <span>
            Autorizo, de forma específica, que esta informação (dado sensível) seja mostrada somente às empresas de vagas para pessoas
            com deficiência em que eu me candidatar, para fins de inclusão e adaptação do processo seletivo.
          </span>
        </label>
        <Button type="submit" disabled={pending} className="w-fit">
          {current ? "Atualizar declaração" : "Registrar declaração"}
        </Button>
      </form>
      {current && (
        <form action={removeDisability}>
          <Button type="submit" variant="ghost" className="text-destructive">
            Apagar declaração
          </Button>
        </form>
      )}
    </div>
  );
}
