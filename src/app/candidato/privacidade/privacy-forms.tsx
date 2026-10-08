"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TalentPoolStatus } from "@/lib/labels";
import { deleteAccount, setTalentPool, type PrivacyState } from "../actions";

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
