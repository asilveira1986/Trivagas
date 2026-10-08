import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { CompanyStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { formatCnpj } from "@/lib/cnpj";
import { cityLabel } from "@/lib/company";
import { COMPANY_STATUSES, type CompanyStatus } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Empresas" };

type Row = {
  id: string;
  trade_name: string;
  cnpj: string;
  status: CompanyStatus;
  updated_at: string;
  cities: { name: string; states: { uf: string } | null } | null;
};

const FILTERS = (Object.entries(COMPANY_STATUSES) as [CompanyStatus, string][]).map(([value, label]) => ({ value, label }));

export default async function AdminCompaniesPage({ searchParams }: PageProps<"/admin/empresas">) {
  const { status, decidida } = await searchParams;
  const filter = FILTERS.find((f) => f.value === status)?.value ?? "pending";

  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, trade_name, cnpj, status, updated_at, cities(name, states(uf))")
    .eq("status", filter)
    .order("updated_at", { ascending: filter === "pending" })
    .limit(100)
    .overrideTypes<Row[], { merge: false }>();
  const companies = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Empresas" description="Valide o CNPJ antes de liberar a publicação de vagas." />
      {typeof decidida === "string" && decidida in COMPANY_STATUSES && (
        <Alert variant="success">Empresa marcada como {COMPANY_STATUSES[decidida as CompanyStatus].toLowerCase()}.</Alert>
      )}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/empresas?status=${f.value}`}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold",
              filter === f.value ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {companies.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Nenhuma empresa aqui.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {companies.map((company) => (
            <li key={company.id}>
              <Link href={`/admin/empresas/${company.id}`} className="flex flex-col gap-1 p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-col">
                  <span className="font-extrabold">{company.trade_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCnpj(company.cnpj)} · {cityLabel(company.cities)}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {timeAgo(company.updated_at)} <CompanyStatusBadge status={company.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
