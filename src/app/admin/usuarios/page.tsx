import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { setUserBlocked } from "../actions";

export const metadata: Metadata = { title: "Usuários" };

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  blocked_at: string | null;
  created_at: string;
  last_active_at: string;
  company_members: { companies: { trade_name: string } | null }[];
};

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const me = await requireProfile();
  const { q, papel, bloqueados } = await searchParams;
  const term = typeof q === "string" ? q.trim().replace(/[%,()]/g, " ").slice(0, 80) : "";
  const role = typeof papel === "string" && papel in ROLE_LABELS ? (papel as UserRole) : null;

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, blocked_at, created_at, last_active_at, company_members(companies(trade_name))")
    .order("created_at", { ascending: false })
    .limit(50);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  if (role) query = query.eq("role", role);
  if (bloqueados === "1") query = query.not("blocked_at", "is", null);
  const { data } = await query.overrideTypes<Row[], { merge: false }>();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Usuários" description="Bloquear impede o acesso ao portal; empresas também podem ser bloqueadas na tela de empresas." />
      <form action="/admin/usuarios" className="grid gap-2 sm:grid-cols-[1fr_180px_auto_auto] sm:items-end">
        <Input name="q" defaultValue={term} placeholder="Nome ou e-mail" aria-label="Nome ou e-mail" />
        <NativeSelect name="papel" defaultValue={role ?? ""} aria-label="Perfil">
          <option value="">Todos os perfis</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="bloqueados" value="1" defaultChecked={bloqueados === "1"} className="size-4 accent-primary" />
          Só bloqueados
        </label>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      <ul className="divide-y rounded-xl border">
        {(data ?? []).map((user) => (
          <li key={user.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {user.full_name || "Sem nome"} <Badge>{ROLE_LABELS[user.role]}</Badge>
                {user.blocked_at && <Badge variant="danger">Bloqueado</Badge>}
              </span>
              <span className="text-sm text-muted-foreground">
                {user.email}
                {user.company_members[0]?.companies && ` · ${user.company_members[0].companies.trade_name}`} · desde{" "}
                {formatDate(user.created_at)} · ativo em {formatDate(user.last_active_at)}
              </span>
            </div>
            {user.id !== me.id && (
              <form action={setUserBlocked}>
                <input type="hidden" name="profileId" value={user.id} />
                <input type="hidden" name="blocked" value={String(!user.blocked_at)} />
                <Button type="submit" size="sm" variant={user.blocked_at ? "outline" : "ghost"} className={user.blocked_at ? "" : "text-destructive"}>
                  {user.blocked_at ? "Desbloquear" : "Bloquear"}
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
