import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewCompany } from "@/app/admin/actions";
import { DecisionForm } from "@/components/admin/decision-form";
import { CompanyStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { lookupCnpj } from "@/lib/brasilapi";
import { formatCnpj } from "@/lib/cnpj";
import { cityLabel, COMPANY_COLUMNS, type Company } from "@/lib/company";
import { formatDate, formatPhone, formatPostalCode } from "@/lib/format";
import { COMPANY_SIZES, MEMBER_ROLES, type MemberRole } from "@/lib/labels";
import { logoUrl } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analisar empresa" };

type Member = { role: MemberRole; profiles: { full_name: string; email: string | null; phone: string | null } | null };

const normalize = (value = "") => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();

export default async function AdminCompanyPage({ params }: PageProps<"/admin/empresas/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select(`${COMPANY_COLUMNS}, created_at`)
    .eq("id", id)
    .maybeSingle<Company & { created_at: string }>();
  if (!company) notFound();

  const [{ data: members }, { count: jobs }, receita] = await Promise.all([
    supabase
      .from("company_members")
      .select("role, profiles(full_name, email, phone)")
      .eq("company_id", company.id)
      .overrideTypes<Member[], { merge: false }>(),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    lookupCnpj(company.cnpj),
  ]);
  const logo = logoUrl(company.logo_path);
  const nameMatches = receita?.razao_social ? normalize(receita.razao_social) === normalize(company.legal_name) : null;
  const active = receita?.descricao_situacao_cadastral ? normalize(receita.descricao_situacao_cadastral) === "ATIVA" : null;

  const fields = [
    ["CNPJ", formatCnpj(company.cnpj)],
    ["Razão social", company.legal_name],
    ["Nome fantasia", company.trade_name],
    ["Segmento", company.segment],
    ["Porte", company.size ? COMPANY_SIZES[company.size] : null],
    ["Endereço", [company.street, company.street_number, company.complement, company.district].filter(Boolean).join(", ")],
    ["CEP", formatPostalCode(company.postal_code)],
    ["Cidade", cityLabel(company.cities)],
    ["Telefone", formatPhone(company.phone)],
    ["E-mail", company.email],
    ["Site", company.website],
    ["Cadastro em", formatDate(company.created_at)],
    ["Vagas criadas", String(jobs ?? 0)],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/empresas" className="text-sm font-semibold text-primary hover:underline">
        ← Empresas
      </Link>
      <div className="flex items-center gap-4">
        {logo && <Image src={logo} alt="" width={64} height={64} className="size-16 rounded-xl border object-contain" unoptimized />}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black">{company.trade_name}</h1>
          <CompanyStatusBadge status={company.status} />
        </div>
      </div>
      {company.status_reason && <Alert>Motivo registrado: {company.status_reason}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <dl className="grid gap-x-6 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {company.description && <p className="whitespace-pre-line text-sm">{company.description}</p>}

          <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
            <h2 className="font-extrabold">Consulta na Receita Federal</h2>
            {receita ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Razão social</dt>
                  <dd className={nameMatches === false ? "font-semibold text-destructive" : "font-semibold"}>
                    {receita.razao_social} {nameMatches === false && "(diferente do cadastro)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Situação</dt>
                  <dd className={active === false ? "font-semibold text-destructive" : "font-semibold"}>
                    {receita.descricao_situacao_cadastral}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Atividade principal</dt>
                  <dd className="font-semibold">{receita.cnae_fiscal_descricao}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Município</dt>
                  <dd className="font-semibold">
                    {receita.municipio} - {receita.uf}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground">
                Consulta automática indisponível para este CNPJ agora. Confira manualmente no site da Receita Federal.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
            <h2 className="font-extrabold">Usuários</h2>
            <ul className="flex flex-col gap-2">
              {(members ?? []).map((member, index) => (
                <li key={index}>
                  <strong>{member.profiles?.full_name}</strong> ({MEMBER_ROLES[member.role]}) · {member.profiles?.email} ·{" "}
                  {formatPhone(member.profiles?.phone)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-3 rounded-xl border p-4">
          <h2 className="font-extrabold">Decisão</h2>
          <DecisionForm
            action={reviewCompany.bind(null, company.id)}
            fieldName="status"
            options={[
              { value: "approved", label: company.status === "blocked" ? "Desbloquear (aprovar)" : "Aprovar", needsReason: false, disabled: company.status === "approved" },
              { value: "rejected", label: "Reprovar", needsReason: true, disabled: company.status === "rejected" },
              { value: "blocked", label: "Bloquear", needsReason: true, disabled: company.status === "blocked" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
