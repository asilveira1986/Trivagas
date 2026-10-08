"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import type { TalentActionState } from "../actions";

export function InviteForm({
  action,
  jobs,
  defaultJobId,
  candidateName,
}: {
  action: (state: TalentActionState, formData: FormData) => Promise<TalentActionState>;
  jobs: { id: string; title: string; unavailable: string | null }[];
  defaultJobId: string | null;
  candidateName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const onSubmit = usePreservingSubmit(formAction);
  const firstAvailable = jobs.find((job) => !job.unavailable)?.id ?? "";
  const initial = jobs.some((job) => job.id === defaultJobId && !job.unavailable) ? defaultJobId! : firstAvailable;

  if (state.message) return <Alert variant="success">{state.message}</Alert>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Vaga
        <NativeSelect name="jobId" defaultValue={initial} required>
          {jobs.map((job) => (
            <option key={job.id} value={job.id} disabled={Boolean(job.unavailable)}>
              {job.title}
              {job.unavailable ? ` (${job.unavailable})` : ""}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Mensagem (opcional)
        <Textarea
          name="message"
          rows={4}
          maxLength={1000}
          defaultValue={`Olá, ${candidateName.split(" ")[0]}! Seu perfil combina com a nossa vaga. Gostaríamos que você participasse da seleção.`}
        />
      </label>
      <Button type="submit" disabled={pending || !firstAvailable}>
        Enviar convite
      </Button>
      <p className="text-xs text-muted-foreground">O candidato recebe o convite por e-mail. Telefone, e-mail e PDF são liberados se ele aceitar.</p>
    </form>
  );
}
