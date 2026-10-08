import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Portabilidade (LGPD): todos os dados do candidato em JSON.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "candidate") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const supabase = await createClient();
  const [resume, applications, consents, invites] = await Promise.all([
    supabase
      .from("resumes")
      .select("*, resume_experiences(*), resume_education(*), resume_skills(level, skills(name))")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    supabase.from("applications").select("id, stage, source, created_at, jobs(title, companies(trade_name)), application_answers(answer, job_questions(question))"),
    supabase.from("consents").select("purpose, granted, term_version, job_id, created_at").order("created_at"),
    supabase.from("talent_invites").select("status, message, created_at, responded_at, jobs(title, companies(trade_name))"),
  ]);

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      profile,
      resume: resume.data,
      applications: applications.data,
      talent_invites: invites.data,
      consents: consents.data,
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="trivagas-meus-dados.json"`,
      "Cache-Control": "no-store",
    },
  });
}
