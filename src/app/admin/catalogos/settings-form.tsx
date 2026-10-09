"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { addCatalogItem, saveSettings, type ModerationState } from "../actions";

const WEIGHTS = [
  { key: "required_skills", label: "Habilidades exigidas" },
  { key: "desired_skills", label: "Habilidades desejáveis" },
  { key: "area", label: "Área de atuação" },
  { key: "experience", label: "Tempo de experiência" },
  { key: "education", label: "Escolaridade" },
] as const;

export function SettingsForm({
  weights,
  radius,
  retention,
}: {
  weights: Record<string, number>;
  radius: number;
  retention: number;
}) {
  const [state, action, pending] = useActionState<ModerationState & { saved?: boolean }, FormData>(saveSettings, {});
  const onSubmit = usePreservingSubmit(action);
  const [values, setValues] = useState(weights);
  const total = WEIGHTS.reduce((sum, w) => sum + (Number(values[w.key]) || 0), 0);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.saved && <Alert variant="success">Configurações salvas. A busca de talentos já usa os novos valores.</Alert>}
      <fieldset className="grid gap-3 sm:grid-cols-5">
        <legend className="mb-2 text-sm font-semibold">
          Pesos da aderência (soma: <span className={total === 100 ? "text-primary" : "text-destructive"}>{total}</span> de 100)
        </legend>
        {WEIGHTS.map((w) => (
          <label key={w.key} className="flex flex-col gap-1 text-sm">
            {w.label}
            <Input
              name={w.key}
              type="number"
              min={0}
              max={100}
              value={values[w.key] ?? 0}
              onChange={(e) => setValues((v) => ({ ...v, [w.key]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Raio de proximidade padrão (km)
          <Input name="default_radius_km" type="number" min={1} max={1000} defaultValue={radius} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Remover currículo inativo após (meses)
          <Input name="resume_retention_months" type="number" min={2} max={60} defaultValue={retention} />
        </label>
      </div>
      <Button type="submit" disabled={pending || total !== 100} className="w-fit">
        Salvar configurações
      </Button>
    </form>
  );
}

export function AddCatalogItemForm({ table, label }: { table: "areas" | "skills"; label: string }) {
  const [state, action, pending] = useActionState<ModerationState, FormData>(addCatalogItem, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="table" value={table} />
      <div className="flex gap-2">
        <Input name="name" placeholder={label} maxLength={80} required aria-label={label} />
        <Button type="submit" variant="outline" disabled={pending}>
          Adicionar
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
