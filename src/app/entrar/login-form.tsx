"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { GoogleButton } from "@/components/forms/google-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sendMagicLink, signInWithPassword, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [passwordState, passwordAction, passwordPending] = useActionState<LoginState, FormData>(signInWithPassword, {});
  const [magicState, magicAction, magicPending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const state = mode === "password" ? passwordState : magicState;

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton next={next} />

      <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-semibold" role="tablist">
        {(["password", "magic"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn("rounded-md py-2", mode === value ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {value === "password" ? "Senha" : "Link por e-mail"}
          </button>
        ))}
      </div>

      {notice && !state.error && !state.message && <Alert>{notice}</Alert>}
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}

      <form action={mode === "password" ? passwordAction : magicAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
        </div>
        {mode === "password" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
        )}
        <Button type="submit" disabled={passwordPending || magicPending}>
          {mode === "password" ? "Entrar" : "Enviar link de acesso"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-primary hover:underline">
          Crie em menos de um minuto
        </Link>
      </p>
    </div>
  );
}
