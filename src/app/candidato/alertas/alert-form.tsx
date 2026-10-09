"use client";

import { useActionState } from "react";
import { CitySelect } from "@/components/forms/city-select";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { CONTRACT_TYPES, WORK_MODES } from "@/lib/labels";
import { createAlert, type AlertState } from "./actions";

export type AlertDefaults = {
  name: string;
  q: string;
  city: { id: number; label: string } | null;
  radius: string;
  area: string;
  mode: string;
  contract: string;
  affirmative: boolean;
};

export function AlertForm({ defaults, areas }: { defaults: AlertDefaults; areas: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<AlertState, FormData>(createAlert, {});
  const onSubmit = usePreservingSubmit(formAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      {state.error && <Alert variant="destructive" className="sm:col-span-2">{state.error}</Alert>}
      {state.message && <Alert variant="success" className="sm:col-span-2">{state.message}</Alert>}
      <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
        Nome do alerta
        <Input name="name" maxLength={80} defaultValue={defaults.name} placeholder="Ex.: Atendente perto de casa" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
        Palavra-chave
        <Input name="q" maxLength={100} defaultValue={defaults.q} placeholder="Ex.: atendente, vendedor" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Cidade
        <CitySelect name="cidade" defaultValue={defaults.city} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Distância máxima (km)
        <Input name="raio" type="number" min={0} max={1000} defaultValue={defaults.radius} placeholder="30" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Área
        <NativeSelect name="area" defaultValue={defaults.area}>
          <option value="">Todas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Modalidade
          <NativeSelect name="modalidade" defaultValue={defaults.mode}>
            <option value="">Todas</option>
            {Object.entries(WORK_MODES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Contrato
          <NativeSelect name="contrato" defaultValue={defaults.contract}>
            <option value="">Todos</option>
            {Object.entries(CONTRACT_TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Frequência
        <NativeSelect name="frequencia" defaultValue="daily">
          <option value="daily">Diária</option>
          <option value="weekly">Semanal</option>
        </NativeSelect>
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold sm:self-end">
        <input type="checkbox" name="afirmativas" value="1" defaultChecked={defaults.affirmative} className="size-4 accent-primary" />
        Só vagas afirmativas
      </label>
      <Button type="submit" disabled={pending} className="w-fit sm:col-span-2">
        Criar alerta
      </Button>
    </form>
  );
}
