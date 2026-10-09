import "server-only";
import type { AffirmativeKind, ContractType, WorkMode } from "@/lib/labels";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicJob = {
  id: string;
  slug: string;
  title: string;
  company_name: string;
  company_slug: string;
  logo_path: string | null;
  city_name: string | null;
  uf: string | null;
  work_mode: WorkMode;
  contract_type: ContractType;
  salary_min: number | null;
  salary_max: number | null;
  published_at: string;
  distance_km: number | null;
  affirmative: AffirmativeKind | null;
  is_confidential: boolean;
  total_count: number;
};

export type PublicJobFilters = {
  query: string | null;
  cityId: number | null;
  radiusKm: number | null;
  areaId: string | null;
  mode: WorkMode | null;
  contract: ContractType | null;
  affirmativeOnly?: boolean;
  page: number;
};

export const PUBLIC_PAGE_SIZE = 20;
const MODES = ["on_site", "hybrid", "remote"];
const CONTRACTS = ["clt", "pj", "internship", "temporary"];

export function parsePublicJobFilters(params: Record<string, string | string[] | undefined>): PublicJobFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim() : "");
  const int = (key: string, max: number) => {
    const value = Number.parseInt(one(key), 10);
    return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
  };
  return {
    query: one("q").slice(0, 100) || null,
    cityId: int("cidade", 9_999_999),
    radiusKm: int("raio", 1000),
    areaId: /^[0-9a-f-]{36}$/i.test(one("area")) ? one("area") : null,
    mode: MODES.includes(one("modalidade")) ? (one("modalidade") as WorkMode) : null,
    contract: CONTRACTS.includes(one("contrato")) ? (one("contrato") as ContractType) : null,
    affirmativeOnly: one("afirmativas") === "1",
    page: Math.max(1, int("pagina", 500) ?? 1),
  };
}

export async function searchPublicJobs(filters: PublicJobFilters, pageSize = PUBLIC_PAGE_SIZE) {
  const { data } = await createPublicClient().rpc("search_jobs", {
    query: filters.query,
    center_city: filters.cityId,
    radius_km: filters.radiusKm,
    area: filters.areaId,
    mode: filters.mode,
    contract: filters.contract,
    affirmative_only: filters.affirmativeOnly ?? false,
    page_size: pageSize,
    page_offset: (filters.page - 1) * pageSize,
  });
  return (data ?? []) as PublicJob[];
}
