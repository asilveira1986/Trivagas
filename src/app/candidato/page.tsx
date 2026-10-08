import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { ComingSoonCard } from "@/components/layout/area-shell";
import { StageBadge } from "@/components/status-stage";
import { Button } from "@/components/ui/button";
import type { ApplicationStage } from "@/lib/labels";
import { getMyResume, resumeChecklist } from "@/lib/resume";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Área do candidato" };

type Row = { id: string; stage: ApplicationStage; jobs: { title: string; companies: { trade_name: string } | null } | null };

export default async function CandidateHome() {
  const supabase = await createClient();
  const [resume, { data: applications }] = await Promise.all([
    getMyResume(),
    supabase
      .from("applications")
      .select("id, stage, jobs(title, companies(trade_name))")
      .order("updated_at", { ascending: false })
      .limit(5)
      .overrideTypes<Row[], { merge: false }>(),
  ]);
  const checklist = resumeChecklist(resume);
  const done = checklist.filter((item) => item.done).length;
  const percent = Math.round((done / checklist.length) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-4 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Meu currículo</h2>
          <span className="font-heading text-2xl font-black text-primary">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              {item.done ? <CheckCircle2 className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
              {item.label}
            </li>
          ))}
        </ul>
        <Button asChild className="w-fit">
          <Link href="/candidato/curriculo">{percent === 100 ? "Ver currículo" : "Completar currículo"}</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-extrabold">Candidaturas recentes</h2>
        {applications?.length ? (
          <ul className="flex flex-col divide-y">
            {applications.map((application) => (
              <li key={application.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{application.jobs?.title}</strong>
                  <span className="text-muted-foreground"> · {application.jobs?.companies?.trade_name}</span>
                </span>
                <StageBadge stage={application.stage} audience="candidate" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma candidatura ainda. Abra o link de uma vaga para se candidatar.</p>
        )}
        <Link href="/candidato/candidaturas" className="text-sm font-semibold text-primary hover:underline">
          Ver todas
        </Link>
      </section>

      <ComingSoonCard
        title="Banco de talentos"
        text="Autorize, pause ou retire seu currículo da busca das empresas e receba convites para vagas."
        phase="Fase 3"
      />
    </div>
  );
}
