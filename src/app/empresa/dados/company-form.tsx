"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { ImageUp } from "lucide-react";
import { CitySelect } from "@/components/forms/city-select";
import { Field } from "@/components/forms/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY_SIZES } from "@/lib/labels";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { saveCompany, type CompanyFormState } from "./actions";

export type CompanyFormValues = {
  cnpj: string;
  legalName: string;
  tradeName: string;
  segment: string;
  size: string;
  postalCode: string;
  street: string;
  streetNumber: string;
  complement: string;
  district: string;
  city: { id: number; label: string } | null;
  phone: string;
  email: string;
  website: string;
  description: string;
  logoUrl: string | null;
};

export function CompanyForm({ values, readOnly, isNew }: { values: CompanyFormValues; readOnly: boolean; isNew: boolean }) {
  const [state, action, pending] = useActionState<CompanyFormState, FormData>(saveCompany, {});
  const onSubmit = usePreservingSubmit(action);
  const [preview, setPreview] = useState<string | null>(values.logoUrl);
  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.saved && <Alert variant="success">Dados salvos.</Alert>}

      <fieldset disabled={readOnly || pending} className="flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-extrabold sm:col-span-2">Identificação</h2>
          <Field id="cnpj" label="CNPJ" errors={errors.cnpj} hint="Aceita o novo CNPJ alfanumérico.">
            <Input id="cnpj" name="cnpj" required defaultValue={values.cnpj} placeholder="00.000.000/0000-00" aria-invalid={!!errors.cnpj} />
          </Field>
          <Field id="legalName" label="Razão social" errors={errors.legalName}>
            <Input id="legalName" name="legalName" required defaultValue={values.legalName} aria-invalid={!!errors.legalName} />
          </Field>
          <Field id="tradeName" label="Nome fantasia" hint="É o nome exibido nas vagas." errors={errors.tradeName}>
            <Input id="tradeName" name="tradeName" required defaultValue={values.tradeName} aria-invalid={!!errors.tradeName} />
          </Field>
          <Field id="segment" label="Segmento" errors={errors.segment}>
            <Input id="segment" name="segment" placeholder="Ex.: Varejo de moda" defaultValue={values.segment} />
          </Field>
          <Field id="size" label="Porte" errors={errors.size}>
            <NativeSelect id="size" name="size" defaultValue={values.size}>
              <option value="">Selecione</option>
              {Object.entries(COMPANY_SIZES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-extrabold sm:col-span-2">Endereço</h2>
          <Field id="postalCode" label="CEP" errors={errors.postalCode}>
            <Input id="postalCode" name="postalCode" inputMode="numeric" defaultValue={values.postalCode} aria-invalid={!!errors.postalCode} />
          </Field>
          <Field id="cityId" label="Cidade" errors={errors.cityId}>
            <CitySelect id="cityId" name="cityId" required defaultValue={values.city} invalid={!!errors.cityId} />
          </Field>
          <Field id="street" label="Logradouro" errors={errors.street}>
            <Input id="street" name="street" defaultValue={values.street} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="streetNumber" label="Número" errors={errors.streetNumber}>
              <Input id="streetNumber" name="streetNumber" defaultValue={values.streetNumber} />
            </Field>
            <Field id="complement" label="Complemento" errors={errors.complement}>
              <Input id="complement" name="complement" defaultValue={values.complement} />
            </Field>
          </div>
          <Field id="district" label="Bairro" errors={errors.district}>
            <Input id="district" name="district" defaultValue={values.district} />
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-extrabold sm:col-span-2">Contato e apresentação</h2>
          <Field id="phone" label="Telefone" errors={errors.phone}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={values.phone} aria-invalid={!!errors.phone} />
          </Field>
          <Field id="email" label="E-mail de contato" errors={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={values.email} aria-invalid={!!errors.email} />
          </Field>
          <Field id="website" label="Site" errors={errors.website}>
            <Input id="website" name="website" placeholder="www.suaempresa.com.br" defaultValue={values.website} aria-invalid={!!errors.website} />
          </Field>
          <Field id="logo" label="Logotipo" hint="PNG, JPG ou WebP, até 1 MB. Aparece nas vagas e na prévia do link." errors={errors.logo}>
            <div className="flex items-center gap-3">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {preview ? (
                  <Image src={preview} alt="Logotipo" width={64} height={64} className="size-full object-contain" unoptimized />
                ) : (
                  <ImageUp className="size-6 text-muted-foreground" />
                )}
              </span>
              <Input
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="pt-2"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : values.logoUrl);
                }}
              />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field id="description" label="Sobre a empresa" errors={errors.description}>
              <Textarea id="description" name="description" rows={5} defaultValue={values.description} maxLength={5000} />
            </Field>
          </div>
        </section>
      </fieldset>

      {!readOnly && (
        <Button type="submit" disabled={pending} className="sm:w-fit">
          {pending ? "Salvando…" : isNew ? "Enviar cadastro para análise" : "Salvar alterações"}
        </Button>
      )}
    </form>
  );
}
