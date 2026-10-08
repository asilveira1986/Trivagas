import { Briefcase, GraduationCap, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatSalary } from "@/lib/format";
import { EDUCATION_LEVELS, LANGUAGE_LEVELS, SKILL_LEVELS } from "@/lib/labels";
import type { ResumeDetail } from "@/lib/resume";

const monthYear = (value: string | null) => {
  if (!value) return "";
  const [year, month] = value.split("-");
  return `${month}/${year}`;
};

const period = (start: string | null, end: string | null, current: boolean) =>
  [monthYear(start), current ? "atual" : monthYear(end)].filter(Boolean).join(" – ");

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Briefcase; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Icon className="size-5 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

export function ResumeView({ resume, experienceMonths }: { resume: ResumeDetail; experienceMonths?: number | null }) {
  const salary = formatSalary(resume.desired_salary, null);
  const years = experienceMonths ? Math.floor(experienceMonths / 12) : 0;
  const months = experienceMonths ? experienceMonths % 12 : 0;
  const formal = resume.resume_education.filter((e) => !e.is_course);
  const courses = resume.resume_education.filter((e) => e.is_course);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 text-sm">
        {resume.areas && <Badge variant="navy">{resume.areas.name}</Badge>}
        {resume.education_level && <Badge>{EDUCATION_LEVELS[resume.education_level]}</Badge>}
        {experienceMonths != null && experienceMonths > 0 && (
          <Badge>
            {years > 0 && `${years} ${years === 1 ? "ano" : "anos"}`}
            {years > 0 && months > 0 && " e "}
            {months > 0 && `${months} ${months === 1 ? "mês" : "meses"}`} de experiência
          </Badge>
        )}
        {salary && <Badge variant="warning">Pretensão: {salary.replace("A partir de ", "")}</Badge>}
      </div>

      {resume.objective && <p className="whitespace-pre-line leading-relaxed">{resume.objective}</p>}

      {resume.resume_experiences.length > 0 && (
        <Section title="Experiência" icon={Briefcase}>
          <ol className="flex flex-col gap-4 border-l-2 border-border pl-4">
            {resume.resume_experiences.map((e) => (
              <li key={e.id} className="flex flex-col gap-1">
                <span className="font-bold">{e.role_title}</span>
                <span className="text-sm text-muted-foreground">
                  {e.company_name} · {period(e.started_on, e.ended_on, e.is_current)}
                </span>
                {e.activities && <p className="whitespace-pre-line text-sm">{e.activities}</p>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {formal.length + courses.length > 0 && (
        <Section title="Formação e cursos" icon={GraduationCap}>
          <ul className="flex flex-col gap-3">
            {[...formal, ...courses].map((e) => (
              <li key={e.id} className="flex flex-col">
                <span className="font-bold">
                  {e.course} {e.is_course && <span className="font-normal text-muted-foreground">(curso)</span>}
                </span>
                <span className="text-sm text-muted-foreground">
                  {e.institution} · {EDUCATION_LEVELS[e.level]}
                  {(e.started_on || e.ended_on || e.is_current) && ` · ${period(e.started_on, e.ended_on, e.is_current)}`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {resume.resume_skills.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">Habilidades</h2>
          <div className="flex flex-wrap gap-2">
            {resume.resume_skills
              .filter((s) => s.skills)
              .map((s) => (
                <Badge key={s.skills!.id} variant={s.level === "advanced" ? "success" : "default"}>
                  {s.skills!.name} · {SKILL_LEVELS[s.level]}
                </Badge>
              ))}
          </div>
        </section>
      )}

      {resume.languages.length > 0 && (
        <Section title="Idiomas" icon={Languages}>
          <ul className="flex flex-wrap gap-2">
            {resume.languages.map((l) => (
              <li key={l.language}>
                <Badge>
                  {l.language} · {LANGUAGE_LEVELS[l.level]}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
