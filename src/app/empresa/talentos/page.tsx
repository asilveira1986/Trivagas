import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, SlidersHorizontal } from "lucide-react";
import { CitySelect } from "@/components/forms/city-select";
import { PageHeader } from "@/components/layout/area-shell";
import { SkillFilter } from "@/components/talent/skill-filter";
import { TalentCard } from "@/components/talent/talent-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getJobCatalogs } from "@/lib/catalogs";
import { cityLabel, requireMembership } from "@/lib/company";
import { EDUCATION_LEVELS, REGION_MODES, type RegionMode, type WorkMode } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, parseTalentFilters, searchTalent } from "@/lib/talent";

export const metadata: Metadata = { title: "Banco de talentos" };

type JobOption = {
  id: string;
  title: string;
  work_mode: WorkMode;
  region_mode: RegionMode;
  radius_km: number;
  city_id: number | null;
  cities: { name: string; states: { uf: string } | null } | null;
};

export default async function TalentSearchPage({ searchParams }: PageProps<"/empresa/talentos">) {
  const { company } = await requireMembership();
  const params = await searchParams;

  if (company.status !== "approved") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Banco de talentos" />
        <Alert>O banco de talentos é liberado depois que o cadastro da empresa for aprovado.</Alert>
      </div>
    );
  }

  const filters = parseTalentFilters(params);
  const supabase = await createClient();
  const [{ data: jobs }, catalogs] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, work_mode, region_mode, radius_km, city_id, cities(name, states(uf))")
      .eq("company_id", company.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .overrideTypes<JobOption[], { merge: false }>(),
    getJobCatalogs(),
  ]);
  const job = (jobs ?? []).find((j) => j.id === filters.jobId) ?? null;
  if (filters.jobId && !job) filters.jobId = null;

  const { results, error } = await searchTalent(filters);
  const total = results[0]?.total_count ?? 0;
  const radius = filters.radiusKm ?? job?.radius_km ?? 30;

  let city: { id: number; label: string } | null = null;
  if (filters.cityId) {
    const { data } = await supabase
      .from("cities")
      .select("id, name, states(uf)")
      .eq("id", filters.cityId)
      .maybeSingle<{ id: number; name: string; states: { uf: string } | null }>();
    if (data) city = { id: data.id, label: cityLabel(data) ?? "" };
  }

  const hasFilters = Boolean(
    filters.cityId || filters.radiusKm || filters.areaId || filters.skillIds.length || filters.minEducation || filters.minExperienceYears || filters.query,
  );
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string" && value && key !== "pagina") query.set(key, value);
    if (page > 1) query.set("pagina", String(page));
    return `/empresa/talentos?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Banco de talentos"
        description="Currículos de quem autorizou participar do banco. Telefone, e-mail e PDF são liberados quando o candidato aceita seu convite."
        actions={
          <Button asChild variant="outline">
            <Link href="/empresa/talentos/salvos">
              <Bookmark /> Salvos
            </Link>
          </Button>
        }
      />

      <form action="/empresa/talentos" className="flex flex-col gap-4 rounded-xl border p-4">
        <label className="flex flex-col gap-2 text-sm font-semibold">
          Sugestões para a vaga
          <NativeSelect name="vaga" defaultValue={filters.jobId ?? ""}>
            <option value="">Sem vaga (busca livre)</option>
            {(jobs ?? []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </NativeSelect>
        </label>

        <details open={hasFilters} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary">
            <SlidersHorizontal className="size-4" /> Filtros
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Cidade
              <CitySelect name="cidade" defaultValue={city} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Raio (km)
              <Input name="raio" type="number" min={0} max={1000} placeholder={String(job?.radius_km ?? 30)} defaultValue={filters.radiusKm ?? ""} />
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
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Escolaridade mínima
              <NativeSelect name="escolaridade" defaultValue={filters.minEducation ?? ""}>
                <option value="">Qualquer</option>
                {Object.entries(EDUCATION_LEVELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Experiência mínima (anos)
              <Input name="experiencia" type="number" min={0} max={50} defaultValue={filters.minExperienceYears ?? ""} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Palavras-chave
              <Input name="q" placeholder="Ex.: atendimento, caixa" defaultValue={filters.query ?? ""} />
            </label>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-semibold">Habilidades (todas)</span>
              <SkillFilter catalog={catalogs.skills} defaultValue={filters.skillIds} />
            </div>
          </div>
        </details>

        <div className="flex gap-2">
          <Button type="submit">Buscar</Button>
          {(hasFilters || filters.jobId) && (
            <Button asChild variant="ghost">
              <Link href="/empresa/talentos">Limpar</Link>
            </Button>
          )}
        </div>
      </form>

      {job && (
        <Alert>
          {job.work_mode === "remote" ? (
            <>Vaga remota: currículos de todo o Brasil, ordenados por aderência.</>
          ) : (
            <>
              Ordem: mesma cidade ({cityLabel(job.cities)}), até {radius} km, mesmo estado e demais regiões; dentro de cada faixa,
              pela aderência à vaga. Modo da vaga: {REGION_MODES[job.region_mode].toLowerCase()}.
            </>
          )}
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">Não foi possível buscar agora. Tente novamente.</Alert>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhum currículo encontrado{hasFilters ? " com esses filtros" : ""}.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "currículo" : "currículos"}
          </p>
          <ul className="flex flex-col gap-3">
            {results.map((talent) => (
              <TalentCard key={talent.resume_id} talent={talent} jobId={filters.jobId} radiusKm={radius} />
            ))}
          </ul>
          {total > PAGE_SIZE && (
            <nav className="flex items-center justify-between text-sm">
              {filters.page > 1 ? (
                <Link href={pageHref(filters.page - 1)} className="font-semibold text-primary hover:underline">
                  ← Anteriores
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Página {filters.page} de {Math.ceil(total / PAGE_SIZE)}
              </span>
              {filters.page * PAGE_SIZE < total ? (
                <Link href={pageHref(filters.page + 1)} className="font-semibold text-primary hover:underline">
                  Próximos →
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
