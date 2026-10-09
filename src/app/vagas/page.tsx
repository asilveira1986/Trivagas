import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Search } from "lucide-react";
import { CitySelect } from "@/components/forms/city-select";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getCurrentProfile } from "@/lib/auth";
import { getJobCatalogs } from "@/lib/catalogs";
import { cityLabel } from "@/lib/company";
import { CONTRACT_TYPES, WORK_MODES } from "@/lib/labels";
import { PUBLIC_PAGE_SIZE, parsePublicJobFilters, searchPublicJobs } from "@/lib/public-jobs";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ searchParams }: PageProps<"/vagas">): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Object.keys(params).length > 0;
  return {
    title: "Vagas de emprego em todo o Brasil",
    description: "Encontre vagas perto de você: busque por cidade, raio de distância, área, modalidade e tipo de contrato.",
    alternates: { canonical: "/vagas" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function PublicJobsPage({ searchParams }: PageProps<"/vagas">) {
  const params = await searchParams;
  const filters = parsePublicJobFilters(params);
  const explicitCity = typeof params.cidade === "string";

  // Candidato logado: usa a cidade e o raio do currículo como ponto de partida.
  const profile = await getCurrentProfile();
  if (!explicitCity && profile?.role === "candidate" && profile.city_id) {
    filters.cityId = profile.city_id;
    if (filters.radiusKm == null) {
      const supabase = await createClient();
      const { data } = await supabase.from("resumes").select("search_radius_km").eq("profile_id", profile.id).maybeSingle();
      filters.radiusKm = data?.search_radius_km ?? null;
    }
  }

  const [jobs, catalogs, cityRow] = await Promise.all([
    searchPublicJobs(filters),
    getJobCatalogs(),
    filters.cityId
      ? createPublicClient()
          .from("cities")
          .select("id, name, states(uf)")
          .eq("id", filters.cityId)
          .maybeSingle<{ id: number; name: string; states: { uf: string } | null }>()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);
  const city = cityRow ? { id: cityRow.id, label: cityLabel(cityRow) ?? "" } : null;
  const total = jobs[0]?.total_count ?? 0;
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string" && value && key !== "pagina") query.set(key, value);
    if (filters.cityId && !query.has("cidade")) query.set("cidade", String(filters.cityId));
    if (page > 1) query.set("pagina", String(page));
    return `/vagas?${query.toString()}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black">Vagas de emprego</h1>
        <p className="text-muted-foreground">Vagas revisadas pela equipe do Trivagas, de empresas com cadastro aprovado.</p>
      </div>

      <form action="/vagas" className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">
          Cargo ou palavra-chave
          <Input name="q" defaultValue={filters.query ?? ""} placeholder="Ex.: atendente, vendedor, motorista" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Cidade
          <CitySelect name="cidade" defaultValue={city} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Distância máxima (km)
          <Input name="raio" type="number" min={0} max={1000} placeholder="30" defaultValue={filters.radiusKm ?? ""} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Área
          <NativeSelect name="area" defaultValue={filters.areaId ?? ""}>
            <option value="">Todas</option>
            {catalogs.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Modalidade
            <NativeSelect name="modalidade" defaultValue={filters.mode ?? ""}>
              <option value="">Todas</option>
              {Object.entries(WORK_MODES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Contrato
            <NativeSelect name="contrato" defaultValue={filters.contract ?? ""}>
              <option value="">Todos</option>
              {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
          <input type="checkbox" name="afirmativas" value="1" defaultChecked={filters.affirmativeOnly} className="size-4 accent-primary" />
          Só vagas afirmativas (PcD, mulheres, pessoas negras e outras)
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">
            <Search /> Buscar vagas
          </Button>
          <Button asChild variant="ghost">
            <Link href="/vagas?cidade=">Limpar</Link>
          </Button>
        </div>
      </form>

      <p className="text-sm">
        <Link
          href={`/candidato/alertas?${new URLSearchParams(
            Object.entries({
              q: filters.query ?? "",
              cidade: filters.cityId ? String(filters.cityId) : "",
              raio: filters.radiusKm != null ? String(filters.radiusKm) : "",
              area: filters.areaId ?? "",
              modalidade: filters.mode ?? "",
              contrato: filters.contract ?? "",
              afirmativas: filters.affirmativeOnly ? "1" : "",
            }).filter(([, v]) => v),
          ).toString()}`}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          <BellRing className="size-4" /> Criar alerta com esta busca
        </Link>
      </p>

      {city && (
        <p className="text-sm text-muted-foreground">
          Mostrando vagas até {filters.radiusKm ?? 30} km de {city.label}, das mais próximas para as mais distantes, e vagas
          remotas.
        </p>
      )}

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-semibold">Nenhuma vaga encontrada com esses filtros.</p>
          <p className="text-sm text-muted-foreground">Aumente a distância ou tente outra palavra-chave.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "vaga" : "vagas"}
          </p>
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
          {total > PUBLIC_PAGE_SIZE && (
            <nav className="flex items-center justify-between text-sm">
              {filters.page > 1 ? (
                <Link href={pageHref(filters.page - 1)} className="font-semibold text-primary hover:underline">
                  ← Anteriores
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Página {filters.page} de {Math.ceil(total / PUBLIC_PAGE_SIZE)}
              </span>
              {filters.page * PUBLIC_PAGE_SIZE < total ? (
                <Link href={pageHref(filters.page + 1)} className="font-semibold text-primary hover:underline">
                  Próximas →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
