"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MEMBER_ROLES } from "@/lib/labels";
import { addMember, type MemberActionState } from "./actions";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(addMember, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border p-5">
      <h2 className="text-lg font-extrabold">Adicionar usuário</h2>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field id="member-email" label="E-mail da conta de empresa">
          <Input id="member-email" name="email" type="email" required />
        </Field>
        <Field id="member-role" label="Papel">
          <NativeSelect id="member-role" name="role" defaultValue="recruiter">
            {Object.entries(MEMBER_ROLES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={pending}>
          Adicionar
        </Button>
      </div>
    </form>
  );
}
