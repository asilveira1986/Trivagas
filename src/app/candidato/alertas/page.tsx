import type { Metadata } from "next";
import { BellOff, BellRing } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { getJobCatalogs } from "@/lib/catalogs";
import { cityLabel } from "@/lib/company";
import { formatDate } from "@/lib/format";
import { CONTRACT_TYPES, WORK_MODES, type ContractType, type WorkMode } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { updateAlert } from "./actions";
import { AlertForm } from "./alert-form";

export const metadata: Metadata = { title: "Alertas de vagas" };

type Row = {
  id: string;
  name: string;
  query: string | null;
  radius_km: number | null;
  work_mode: WorkMode | null;
  contract_type: ContractType | null;
  affirmative_only: boolean;
  frequency: "daily" | "weekly";
  active: boolean;
  last_sent_at: string | null;
  cities: { name: string; states: { uf: string } | null } | null;
  areas: { name: string } | null;
};

export default async function AlertsPage({ searchParams }: PageProps<"/candidato/alertas">) {
  const profile = await requireRole("candidate");
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const supabase = await createClient();
  const cityId = Number(one("cidade")) || profile.city_id;
  const [{ data }, catalogs, { data: city }] = await Promise.all([
    supabase
      .from("job_alerts")
      .select("id, name, query, radius_km, work_mode, contract_type, affirmative_only, frequency, active, last_sent_at, cities(name, states(uf)), areas(name)")
      .order("created_at")
      .overrideTypes<Row[], { merge: false }>(),
    getJobCatalogs(),
    cityId
      ? supabase.from("cities").select("id, name, states(uf)").eq("id", cityId).maybeSingle<{ id: number; name: string; states: { uf: string } | null }>()
      : Promise.resolve({ data: null }),
  ]);
  const alerts = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Alertas de vagas" description="Receba por e-mail as vagas novas que combinam com você (até 5 alertas)." />

      {alerts.length > 0 && (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => {
            const filters = [
              alert.query && `“${alert.query}”`,
              alert.cities && `${cityLabel(alert.cities)} (até ${alert.radius_km ?? 30} km)`,
              alert.areas?.name,
              alert.work_mode && WORK_MODES[alert.work_mode],
              alert.contract_type && CONTRACT_TYPES[alert.contract_type],
              alert.affirmative_only && "só afirmativas",
            ].filter(Boolean);
            return (
              <li key={alert.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 font-extrabold">
                    {alert.active ? <BellRing className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
                    {alert.name}
                    <Badge>{alert.frequency === "daily" ? "Diário" : "Semanal"}</Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">{filters.join(" · ")}</span>
                  {alert.last_sent_at && <span className="text-xs text-muted-foreground">Última verificação: {formatDate(alert.last_sent_at)}</span>}
                </div>
                <form action={updateAlert} className="flex gap-2">
                  <input type="hidden" name="id" value={alert.id} />
                  <input type="hidden" name="active" value={String(!alert.active)} />
                  <Button type="submit" name="intent" value="toggle" size="sm" variant="outline">
                    {alert.active ? "Pausar" : "Reativar"}
                  </Button>
                  <Button type="submit" name="intent" value="delete" size="sm" variant="ghost" className="text-destructive">
                    Excluir
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {alerts.length < 5 && (
        <section className="flex flex-col gap-3 rounded-xl border p-5">
          <h2 className="text-lg font-extrabold">Novo alerta</h2>
          <AlertForm
            areas={catalogs.areas}
            defaults={{
              name: one("q") ? `Vagas de ${one("q")}` : "Vagas perto de mim",
              q: one("q"),
              city: city ? { id: city.id, label: cityLabel(city) ?? "" } : null,
              radius: one("raio"),
              area: one("area"),
              mode: one("modalidade"),
              contract: one("contrato"),
              affirmative: one("afirmativas") === "1",
            }}
          />
        </section>
      )}
    </div>
  );
}
