import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { requireMembership } from "@/lib/company";
import { MEMBER_ROLES, type MemberRole } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { updateMember } from "./actions";
import { AddMemberForm } from "./add-member-form";

export const metadata: Metadata = { title: "Usuários da empresa" };

type MemberRow = {
  profile_id: string;
  role: MemberRole;
  profiles: { full_name: string; email: string | null } | null;
};

export default async function CompanyUsersPage() {
  const [profile, { company, role }] = await Promise.all([requireProfile(), requireMembership()]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_members")
    .select("profile_id, role, profiles(full_name, email)")
    .eq("company_id", company.id)
    .order("created_at")
    .overrideTypes<MemberRow[], { merge: false }>();
  const isAdmin = role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários da empresa"
        description="Administradores gerenciam dados, vagas e usuários; recrutadores gerenciam vagas e candidatos."
      />
      <ul className="divide-y rounded-xl border">
        {(data ?? []).map((member) => (
          <li key={member.profile_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col">
              <span className="font-semibold">
                {member.profiles?.full_name || "Sem nome"}
                {member.profile_id === profile.id && <span className="text-muted-foreground"> (você)</span>}
              </span>
              <span className="text-sm text-muted-foreground">{member.profiles?.email}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={member.role === "admin" ? "navy" : "default"}>{MEMBER_ROLES[member.role]}</Badge>
              {isAdmin && member.profile_id !== profile.id && (
                <form action={updateMember} className="flex gap-2">
                  <input type="hidden" name="profileId" value={member.profile_id} />
                  <Button
                    type="submit"
                    name="intent"
                    value={member.role === "admin" ? "recruiter" : "admin"}
                    variant="outline"
                    size="sm"
                  >
                    Tornar {member.role === "admin" ? "recrutador" : "administrador"}
                  </Button>
                  <Button type="submit" name="intent" value="remove" variant="ghost" size="sm" className="text-destructive">
                    Remover
                  </Button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
      {isAdmin && <AddMemberForm />}
    </div>
  );
}
