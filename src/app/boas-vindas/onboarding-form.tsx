"use client";

import { useActionState, useState } from "react";
import { CitySelect } from "@/components/forms/city-select";
import { Field } from "@/components/forms/field";
import { RolePicker, type SignupRole } from "@/components/forms/role-picker";
import { TermsCheckbox } from "@/components/forms/terms-checkbox";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { completeOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({
  initialRole,
  defaultName,
  next,
}: {
  initialRole: SignupRole;
  defaultName: string;
  next: string;
}) {
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const onSubmit = usePreservingSubmit(action);
  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <RolePicker value={role} onChange={setRole} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="next" value={next} />
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      <Field id="fullName" label={role === "company" ? "Seu nome (responsável)" : "Nome completo"} errors={errors.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={defaultName} aria-invalid={!!errors.fullName} />
      </Field>
      <Field id="cityId" label="Cidade" errors={errors.cityId}>
        <CitySelect id="cityId" name="cityId" required invalid={!!errors.cityId} />
      </Field>
      <Field id="phone" label="WhatsApp" hint="Com DDD. Usado só para contato sobre vagas." errors={errors.phone}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 98888-7777" required aria-invalid={!!errors.phone} />
      </Field>
      <TermsCheckbox error={errors.acceptTerms?.[0]} />
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Concluir cadastro"}
      </Button>
    </form>
  );
}
