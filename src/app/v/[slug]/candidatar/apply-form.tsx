"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import type { JobQuestion } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import type { ApplyState } from "./actions";

function ChoiceGroup({ question, options }: { question: JobQuestion; options: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">
        {question.question}
        {!question.is_required && <span className="font-normal text-muted-foreground"> (opcional)</span>}
      </legend>
      <div className={cn("grid gap-2", options.length <= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input type="radio" name={`q_${question.id}`} value={option} required={question.is_required} className="accent-primary" />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ApplyForm({
  action,
  questions,
  companyName,
}: {
  action: (state: ApplyState, formData: FormData) => Promise<ApplyState>;
  questions: JobQuestion[];
  companyName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const onSubmit = usePreservingSubmit(formAction);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}

      {questions.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-extrabold">Perguntas da empresa</h2>
          {questions.map((question) =>
            question.type === "yes_no" ? (
              <ChoiceGroup key={question.id} question={question} options={["Sim", "Não"]} />
            ) : question.type === "single_choice" ? (
              <ChoiceGroup key={question.id} question={question} options={question.options} />
            ) : (
              <label key={question.id} className="flex flex-col gap-2 text-sm font-semibold">
                <span>
                  {question.question}
                  {!question.is_required && <span className="font-normal text-muted-foreground"> (opcional)</span>}
                </span>
                <Input name={`q_${question.id}`} maxLength={300} required={question.is_required} />
              </label>
            ),
          )}
        </section>
      )}

      <label className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-primary" />
        <span>
          Autorizo o envio do meu currículo e dos meus contatos (telefone e e-mail) para <strong>{companyName}</strong>{" "}
          avaliar esta candidatura, conforme a{" "}
          <Link href="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">
            política de privacidade
          </Link>
          .
        </span>
      </label>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enviando…" : "Enviar candidatura"}
      </Button>
    </form>
  );
}
