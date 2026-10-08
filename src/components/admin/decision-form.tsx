"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; needsReason: boolean; disabled?: boolean };

// Formulário de decisão do administrador (moderação de vaga ou aprovação de empresa).
export function DecisionForm({
  action,
  options,
  fieldName,
  submitLabel = "Registrar decisão",
}: {
  action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  options: Option[];
  fieldName: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const onSubmit = usePreservingSubmit(formAction);
  const [choice, setChoice] = useState<string>("");
  const selected = options.find((option) => option.value === choice);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold",
              choice === option.value ? "border-primary bg-primary/5" : "border-border",
              option.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name={fieldName}
              value={option.value}
              disabled={option.disabled}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
      {selected?.needsReason && (
        <Textarea name="reason" rows={4} required placeholder="Motivo (enviado à empresa)" maxLength={2000} />
      )}
      <Button type="submit" disabled={pending || !choice}>
        {submitLabel}
      </Button>
    </form>
  );
}
