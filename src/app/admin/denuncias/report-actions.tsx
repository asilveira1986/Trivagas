"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { handleReport, type ModerationState } from "../actions";

export function ReportActions({ reportId, jobId, jobPublished }: { reportId: string; jobId: string; jobPublished: boolean }) {
  const [state, action, pending] = useActionState<ModerationState, FormData>(handleReport, {});
  const [takedown, setTakedown] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="jobId" value={jobId} />
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {takedown && (
        <Textarea name="reason" rows={3} required placeholder="Motivo enviado à empresa (ex.: cobrança de taxa do candidato)" />
      )}
      <div className="flex flex-wrap gap-2">
        {jobPublished &&
          (takedown ? (
            <Button type="submit" name="intent" value="takedown" size="sm" variant="destructive" disabled={pending}>
              Confirmar retirada da vaga
            </Button>
          ) : (
            <Button type="button" size="sm" variant="destructive" onClick={() => setTakedown(true)}>
              Retirar vaga do ar
            </Button>
          ))}
        <Button type="submit" name="intent" value="resolved" size="sm" variant="outline" disabled={pending} formNoValidate>
          Marcar como resolvida
        </Button>
        <Button type="submit" name="intent" value="dismissed" size="sm" variant="ghost" disabled={pending} formNoValidate>
          Arquivar (improcedente)
        </Button>
      </div>
    </form>
  );
}
