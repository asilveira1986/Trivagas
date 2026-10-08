"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NoteState } from "../actions";

export function NoteForm({ action }: { action: (state: NoteState, formData: FormData) => Promise<NoteState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-2">
      <Textarea name="body" rows={3} maxLength={5000} placeholder="Anotação interna (o candidato não vê)" required />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" className="w-fit" disabled={pending}>
        Adicionar anotação
      </Button>
    </form>
  );
}
