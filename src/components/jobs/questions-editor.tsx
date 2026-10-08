"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { QUESTION_TYPES, type QuestionType } from "@/lib/labels";

export type EditableQuestion = {
  key: string;
  id?: string;
  question: string;
  type: QuestionType;
  options: string[];
  is_required: boolean;
};

const SUGGESTIONS = [
  "Possui CNH?",
  "Tem disponibilidade para trabalhar aos fins de semana?",
  "Mora perto do local de trabalho?",
  "Tem disponibilidade para início imediato?",
];

export const MAX_QUESTIONS = 10;

export function QuestionsEditor({
  value,
  onChange,
}: {
  value: EditableQuestion[];
  onChange: (value: EditableQuestion[]) => void;
}) {
  const update = (key: string, patch: Partial<EditableQuestion>) =>
    onChange(value.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const add = (question = "") =>
    onChange([...value, { key: crypto.randomUUID(), question, type: "yes_no", options: [], is_required: true }]);
  const unused = SUGGESTIONS.filter((s) => !value.some((q) => q.question === s));

  return (
    <div className="flex flex-col gap-3">
      {value.map((q, index) => (
        <div key={q.key} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-start gap-2">
            <span className="mt-2.5 text-sm font-bold text-muted-foreground">{index + 1}.</span>
            <Input
              aria-label={`Pergunta ${index + 1}`}
              value={q.question}
              maxLength={300}
              placeholder="Escreva a pergunta"
              onChange={(event) => update(q.key, { question: event.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover pergunta ${index + 1}`}
              onClick={() => onChange(value.filter((item) => item.key !== q.key))}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <NativeSelect
              aria-label="Tipo de resposta"
              value={q.type}
              onChange={(event) => update(q.key, { type: event.target.value as QuestionType })}
            >
              {Object.entries(QUESTION_TYPES).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            {q.type === "single_choice" && (
              <Input
                aria-label="Opções"
                placeholder="Opções separadas por vírgula (ex.: Manhã, Tarde, Noite)"
                defaultValue={q.options.join(", ")}
                onChange={(event) =>
                  update(q.key, {
                    options: event.target.value
                      .split(",")
                      .map((option) => option.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={q.is_required}
              onChange={(event) => update(q.key, { is_required: event.target.checked })}
            />
            Resposta obrigatória
          </label>
        </div>
      ))}
      {value.length < MAX_QUESTIONS && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => add()}>
            <Plus /> Adicionar pergunta
          </Button>
          {unused.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
