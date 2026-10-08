import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { requireMembership } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { getTalentIdentity } from "@/lib/talent";
import { unsaveTalent } from "../actions";

export const metadata: Metadata = { title: "Talentos salvos" };

type Row = {
  list_name: string;
  resume_id: string;
  resumes: { headline: string | null; cities: { name: string; states: { uf: string } | null } | null } | null;
};

export default async function SavedTalentsPage() {
  const { company } = await requireMembership();
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_resumes")
    .select("list_name, resume_id, resumes(headline, cities(name, states(uf)))")
    .eq("company_id", company.id)
    .order("list_name")
    .order("created_at", { ascending: false })
    .overrideTypes<Row[], { merge: false }>();
  const rows = data ?? [];
  const names = new Map(
    await Promise.all(
      [...new Set(rows.map((r) => r.resume_id))].map(async (id) => [id, (await getTalentIdentity(id))?.display_name] as const),
    ),
  );
  const lists = Map.groupBy(rows, (row) => row.list_name);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/empresa/talentos" className="text-sm font-semibold text-primary hover:underline">
        ← Banco de talentos
      </Link>
      <PageHeader title="Talentos salvos" description="Favoritos e listas da empresa, compartilhados entre os usuários." />
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhum talento salvo. Use “Salvar” nos resultados do banco de talentos.
        </p>
      )}
      {[...lists.entries()].map(([list, items]) => (
        <section key={list} className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">
            {list} <span className="text-sm font-semibold text-muted-foreground">({items.length})</span>
          </h2>
          <ul className="divide-y rounded-xl border">
            {items.map((item) => {
              const name = names.get(item.resume_id);
              return (
                <li key={item.resume_id} className="flex items-center justify-between gap-3 p-3">
                  {name && item.resumes ? (
                    <Link href={`/empresa/talentos/${item.resume_id}`} className="flex flex-col hover:text-primary">
                      <span className="font-semibold">{name}</span>
                      <span className="text-sm text-muted-foreground">
                        {[item.resumes.headline, item.resumes.cities && `${item.resumes.cities.name} - ${item.resumes.cities.states?.uf}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Currículo indisponível (o candidato saiu do banco de talentos)</span>
                  )}
                  <form action={unsaveTalent}>
                    <input type="hidden" name="resumeId" value={item.resume_id} />
                    <input type="hidden" name="listName" value={list} />
                    <button type="submit" aria-label="Remover da lista" className="rounded p-1 text-muted-foreground hover:bg-muted">
                      <X className="size-4" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
