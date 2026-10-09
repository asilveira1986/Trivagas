import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/area-shell";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { toggleCatalogItem } from "../actions";
import { AddCatalogItemForm, SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Catálogos e pesos" };

type Item = { id: string; name: string; active: boolean };

function CatalogList({ table, items }: { table: "areas" | "skills"; items: Item[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <form action={toggleCatalogItem}>
            <input type="hidden" name="table" value={table} />
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="active" value={String(!item.active)} />
            <button
              type="submit"
              title={item.active ? "Clique para desativar" : "Clique para reativar"}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-semibold",
                item.active ? "border-primary/40 bg-primary/10" : "border-dashed text-muted-foreground line-through",
              )}
            >
              {item.name}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export default async function CatalogsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: areas }, { data: skills }] = await Promise.all([
    supabase.from("app_settings").select("key, value").in("key", ["matching_weights", "default_radius_km", "resume_retention_months"]),
    supabase.from("areas").select("id, name, active").order("name"),
    supabase.from("skills").select("id, name, active").order("name"),
  ]);
  const value = (key: string) => settings?.find((s) => s.key === key)?.value;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Catálogos e pesos" description="Ajustes aplicados na hora, sem nova versão do sistema." />

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Aderência, raio e retenção</h2>
        <SettingsForm
          weights={(value("matching_weights") as Record<string, number>) ?? {}}
          radius={Number(value("default_radius_km") ?? 30)}
          retention={Number(value("resume_retention_months") ?? 6)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Áreas de atuação ({areas?.length ?? 0})</h2>
        <p className="text-sm text-muted-foreground">Itens desativados deixam de aparecer nos formulários, sem afetar vagas e currículos existentes.</p>
        <AddCatalogItemForm table="areas" label="Nova área" />
        <CatalogList table="areas" items={(areas ?? []) as Item[]} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Habilidades ({skills?.length ?? 0})</h2>
        <AddCatalogItemForm table="skills" label="Nova habilidade" />
        <CatalogList table="skills" items={(skills ?? []) as Item[]} />
      </section>

      <p className="text-sm text-muted-foreground">
        Cidades e regiões seguem a tabela do IBGE (5.571 municípios), carregada pelas migrações; para atualizar, rode{" "}
        <code className="rounded bg-muted px-1">npm run db:cities</code> e aplique a migração gerada.
      </p>
    </div>
  );
}
