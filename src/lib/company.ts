import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import type { CompanySize, CompanyStatus, MemberRole } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  slug: string;
  cnpj: string;
  legal_name: string;
  trade_name: string;
  segment: string | null;
  size: CompanySize | null;
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  district: string | null;
  city_id: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_path: string | null;
  description: string | null;
  status: CompanyStatus;
  status_reason: string | null;
  cities: { name: string; states: { uf: string } | null } | null;
};

export const COMPANY_COLUMNS =
  "id, slug, cnpj, legal_name, trade_name, segment, size, postal_code, street, street_number, complement, district, city_id, phone, email, website, logo_path, description, status, status_reason, cities(name, states(uf))";

export type Membership = { role: MemberRole; company: Company };

// Empresa do usuário logado (cada usuário de empresa pertence a uma única empresa).
export const getMyMembership = cache(async (): Promise<Membership | null> => {
  const profile = await requireRole("company");
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select(`role, companies(${COMPANY_COLUMNS})`)
    .eq("profile_id", profile.id)
    .maybeSingle<{ role: MemberRole; companies: Company | null }>();
  return data?.companies ? { role: data.role, company: data.companies } : null;
});

// Exige empresa cadastrada; sem ela, leva ao cadastro.
export async function requireMembership(): Promise<Membership> {
  const membership = await getMyMembership();
  if (!membership) redirect("/empresa/dados");
  return membership;
}

export function cityLabel(city: { name: string; states: { uf: string } | null } | null | undefined) {
  return city ? `${city.name} - ${city.states?.uf ?? ""}` : null;
}
