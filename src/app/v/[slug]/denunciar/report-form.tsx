"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { Turnstile } from "@/components/forms/turnstile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import type { ReportState } from "./actions";

export function ReportForm({
  action,
  reasons,
}: {
  action: (state: ReportState, formData: FormData) => Promise<ReportState>;
  reasons: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const onSubmit = usePreservingSubmit(formAction);

  if (state.done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <ShieldCheck className="size-12 text-primary" />
        <h2 className="text-xl font-black">Denúncia recebida</h2>
        <p className="text-sm text-muted-foreground">
          Nossa equipe vai analisar a vaga. Obrigado por ajudar a manter o Trivagas seguro. Nunca pague para participar de um
          processo seletivo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Motivo</legend>
        {reasons.map((reason) => (
          <label
            key={reason}
            className="flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input type="radio" name="reason" value={reason} required className="accent-primary" />
            {reason}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Detalhes (opcional)
        <Textarea name="details" rows={4} maxLength={2000} placeholder="Conte o que aconteceu" />
      </label>
      <Turnstile />
      <Button type="submit" disabled={pending}>
        Enviar denúncia
      </Button>
    </form>
  );
}
