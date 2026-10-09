"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import type { SkillOption } from "@/components/jobs/skill-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { EducationLevel, LanguageLevel } from "@/lib/labels";
import { importResumeFromPdf } from "../actions";
import { ResumeForm, type ResumeFormValues } from "./resume-form";

export function ResumeEditor({
  initial,
  areas,
  skills,
  canImport,
}: {
  initial: ResumeFormValues;
  areas: { id: string; name: string }[];
  skills: SkillOption[];
  canImport: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function runImport() {
    setMessage(null);
    startTransition(async () => {
      const result = await importResumeFromPdf();
      if (!result.data) {
        setMessage({ ok: false, text: result.error ?? "Não foi possível ler o PDF." });
        return;
      }
      const d = result.data;
      // Dados pessoais continuam os do cadastro; o resto vem do PDF (mantém o atual quando o PDF não traz).
      setValues((current) => ({
        ...current,
        headline: d.headline ?? current.headline,
        objective: d.objective ?? current.objective,
        areaId: d.areaId ?? current.areaId,
        educationLevel: d.educationLevel ?? current.educationLevel,
        experiences: d.experiences.length
          ? d.experiences.map((e) => ({ ...e, key: crypto.randomUUID() }))
          : current.experiences,
        education: d.education.length
          ? d.education.map((e) => ({ ...e, level: e.level as EducationLevel, key: crypto.randomUUID() }))
          : current.education,
        skills: d.skills.length ? d.skills : current.skills,
        languages: d.languages.length
          ? d.languages.map((l) => ({ language: l.language, level: l.level as LanguageLevel, key: crypto.randomUUID() }))
          : current.languages,
      }));
      setVersion((v) => v + 1);
      setMessage({ ok: true, text: "Preenchemos o formulário com o que encontramos no PDF. Revise cada item e toque em “Salvar currículo”." });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canImport && (
        <section className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-extrabold">
              <Sparkles className="size-4 text-primary" /> Preencher a partir do PDF
            </h2>
            <Button type="button" size="sm" onClick={runImport} disabled={pending}>
              {pending ? "Lendo o PDF…" : "Ler meu PDF"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O PDF anexado é lido por inteligência artificial (Anthropic) só para sugerir os campos abaixo; nada é salvo sem a sua
            revisão. Substitui o que ainda não foi salvo neste formulário.
          </p>
          {message && <Alert variant={message.ok ? "success" : "destructive"}>{message.text}</Alert>}
        </section>
      )}
      <ResumeForm key={version} values={values} areas={areas} skills={skills} />
    </div>
  );
}
