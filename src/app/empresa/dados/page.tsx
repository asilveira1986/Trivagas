import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { CompanyStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { formatCnpj } from "@/lib/cnpj";
import { cityLabel, getMyMembership } from "@/lib/company";
import { formatPhone, formatPostalCode } from "@/lib/format";
import { companyPath, logoUrl } from "@/lib/links";
import { CompanyForm, type CompanyFormValues } from "./company-form";

export const metadata: Metadata = { title: "Dados da empresa" };

export default async function CompanyDataPage() {
  const membership = await getMyMembership();
  const company = membership?.company;

  const values: CompanyFormValues = {
    cnpj: company ? formatCnpj(company.cnpj) : "",
    legalName: company?.legal_name ?? "",
    tradeName: company?.trade_name ?? "",
    segment: company?.segment ?? "",
    size: company?.size ?? "",
    postalCode: formatPostalCode(company?.postal_code),
    street: company?.street ?? "",
    streetNumber: company?.street_number ?? "",
    complement: company?.complement ?? "",
    district: company?.district ?? "",
    city: company?.city_id ? { id: company.city_id, label: cityLabel(company.cities) ?? "" } : null,
    phone: formatPhone(company?.phone),
    email: company?.email ?? "",
    website: company?.website ?? "",
    description: company?.description ?? "",
    logoUrl: logoUrl(company?.logo_path),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={company ? "Dados da empresa" : "Cadastre sua empresa"}
        description={
          company ? (
            <span className="flex flex-wrap items-center gap-2">
              Situação: <CompanyStatusBadge status={company.status} />
              {company.status === "approved" && (
                <Link href={companyPath(company.slug)} className="font-semibold text-primary hover:underline">
                  Ver página pública
                </Link>
              )}
            </span>
          ) : (
            "Nossa equipe valida o CNPJ antes de liberar a publicação de vagas."
          )
        }
      />
      {company?.status === "rejected" && (
        <Alert variant="destructive">
          Cadastro não aprovado{company.status_reason ? `: ${company.status_reason}` : "."} Corrija os dados e salve para
          enviar novamente.
        </Alert>
      )}
      {company?.status === "approved" && (
        <Alert>Alterar CNPJ ou razão social envia o cadastro para nova análise.</Alert>
      )}
      {membership?.role === "recruiter" && (
        <Alert>Somente administradores da empresa podem alterar estes dados.</Alert>
      )}
      <CompanyForm values={values} readOnly={membership?.role === "recruiter"} isNew={!company} />
    </div>
  );
}
