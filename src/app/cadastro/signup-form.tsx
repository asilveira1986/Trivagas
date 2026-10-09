"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { CitySelect } from "@/components/forms/city-select";
import { Field } from "@/components/forms/field";
import { GoogleButton } from "@/components/forms/google-button";
import { RolePicker, type SignupRole } from "@/components/forms/role-picker";
import { TermsCheckbox } from "@/components/forms/terms-checkbox";
import { Turnstile } from "@/components/forms/turnstile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { signUp, type SignupState } from "./actions";

export function SignupForm({ initialRole, next }: { initialRole: SignupRole; next: string }) {
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, {});
  const onSubmit = usePreservingSubmit(action);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  if (state.sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <MailCheck className="size-12 text-primary" />
        <h2 className="text-xl font-black">Confirme seu e-mail</h2>
        <p className="text-sm text-muted-foreground">
          Enviamos um link para <strong className="text-foreground">{state.sentTo}</strong>. Abra-o neste aparelho para
          ativar sua conta.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <RolePicker value={role} onChange={setRole} />

      <GoogleButton
        next={`/boas-vindas?perfil=${role === "company" ? "empresa" : "candidato"}&next=${encodeURIComponent(next)}`}
        label="Cadastrar com Google"
      />

      <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
      </div>

      {state.error && <Alert variant="destructive">{state.error}</Alert>}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="next" value={next} />
        <Field id="fullName" label={role === "company" ? "Seu nome (responsável)" : "Nome completo"} errors={errors.fullName}>
          <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={values.fullName} aria-invalid={!!errors.fullName} />
        </Field>
        <Field id="cityId" label="Cidade" errors={errors.cityId}>
          <CitySelect id="cityId" name="cityId" required invalid={!!errors.cityId} />
        </Field>
        <Field id="phone" label="WhatsApp" hint="Com DDD. Usado só para contato sobre vagas." errors={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98888-7777"
            required
            defaultValue={values.phone}
            aria-invalid={!!errors.phone}
          />
        </Field>
        <Field id="email" label="E-mail" errors={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={values.email} aria-invalid={!!errors.email} />
        </Field>
        <Field id="password" label="Senha" hint="Mínimo de 8 caracteres." errors={errors.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-invalid={!!errors.password} />
        </Field>
        <TermsCheckbox error={errors.acceptTerms?.[0]} />
        <Turnstile />
        <Button type="submit" disabled={pending}>
          {pending ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
