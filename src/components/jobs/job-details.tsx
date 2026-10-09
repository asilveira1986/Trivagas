import Image from "next/image";
import { Banknote, Briefcase, Building2, CalendarClock, EyeOff, GraduationCap, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatSalary } from "@/lib/format";
import { locationLabel, type JobDetail } from "@/lib/jobs";
import { CONTRACT_TYPES, EDUCATION_LEVELS, WORK_MODES } from "@/lib/labels";
import { logoUrl } from "@/lib/links";

export function JobHeader({ job, as: Heading = "h1" }: { job: JobDetail; as?: "h1" | "h2" }) {
  const logo = logoUrl(job.companies?.logo_path);
  return (
    <div className="flex items-start gap-4">
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
        {logo ? (
          <Image src={logo} alt="" width={64} height={64} className="size-full object-contain" unoptimized />
        ) : job.is_confidential ? (
          <EyeOff className="size-7 text-muted-foreground" />
        ) : (
          <Building2 className="size-7 text-muted-foreground" />
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className="text-2xl font-black leading-tight sm:text-3xl">{job.title}</Heading>
        <p className="font-semibold text-muted-foreground">{job.companies?.trade_name}</p>
      </div>
    </div>
  );
}

export function JobFacts({ job }: { job: JobDetail }) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const facts = [
    { icon: MapPin, label: locationLabel(job) },
    { icon: Briefcase, label: `${CONTRACT_TYPES[job.contract_type]} · ${WORK_MODES[job.work_mode]}` },
    salary && { icon: Banknote, label: salary },
    { icon: Users, label: job.positions === 1 ? "1 vaga" : `${job.positions} vagas` },
    job.min_education && { icon: GraduationCap, label: `Mínimo: ${EDUCATION_LEVELS[job.min_education]}` },
    job.closes_at && { icon: CalendarClock, label: `Inscrições até ${formatDate(job.closes_at)}` },
  ].filter(Boolean) as { icon: typeof MapPin; label: string }[];

  return (
    <ul className="grid gap-2 text-sm sm:grid-cols-2">
      {facts.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" /> {label}
        </li>
      ))}
    </ul>
  );
}

export function JobBody({ job }: { job: JobDetail }) {
  const required = job.job_skills.filter((s) => s.requirement === "required" && s.skills);
  const desired = job.job_skills.filter((s) => s.requirement === "desired" && s.skills);
  const experienceYears = job.min_experience_months ? Math.round((job.min_experience_months / 12) * 10) / 10 : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">Sobre a vaga</h2>
        <p className="whitespace-pre-line leading-relaxed">{job.description}</p>
        {job.areas && <p className="text-sm text-muted-foreground">Área: {job.areas.name}</p>}
        {experienceYears && (
          <p className="text-sm text-muted-foreground">
            Experiência desejada: {experienceYears} {experienceYears === 1 ? "ano" : "anos"}
          </p>
        )}
      </section>

      {(required.length > 0 || desired.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">Habilidades</h2>
          {required.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {required.map(({ skills }) => (
                <Badge key={skills!.id} variant="success">
                  {skills!.name}
                </Badge>
              ))}
            </div>
          )}
          {desired.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Desejáveis</p>
              <div className="flex flex-wrap gap-2">
                {desired.map(({ skills }) => (
                  <Badge key={skills!.id}>{skills!.name}</Badge>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {job.benefits.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">Benefícios</h2>
          <ul className="list-disc space-y-1 pl-5">
            {job.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
