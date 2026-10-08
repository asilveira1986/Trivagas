import Link from "next/link";
import { Bookmark, BookmarkCheck, Check, MapPin, X } from "lucide-react";
import { saveTalent, unsaveTalent } from "@/app/empresa/talentos/actions";
import { Badge } from "@/components/ui/badge";
import { EDUCATION_LEVELS, INVITE_STATUSES } from "@/lib/labels";
import type { TalentResult } from "@/lib/talent";
import { proximityLabel } from "@/lib/talent";
import { cn } from "@/lib/utils";

function Criterion({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", ok ? "text-primary" : "text-muted-foreground")}>
      {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {label}
    </span>
  );
}

function experienceLabel(months: number) {
  if (months === 0) return "Sem experiência registrada";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"} de experiência`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "ano" : "anos"} de experiência`;
}

export function TalentCard({ talent, jobId, radiusKm }: { talent: TalentResult; jobId: string | null; radiusKm: number }) {
  const proximity = proximityLabel(talent, radiusKm);
  const href = `/empresa/talentos/${talent.resume_id}${jobId ? `?vaga=${jobId}` : ""}`;

  return (
    <li className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link href={href} className="text-lg font-extrabold hover:text-primary">
            {talent.display_name}
          </Link>
          {talent.headline && <span className="text-sm text-muted-foreground">{talent.headline}</span>}
        </div>
        {talent.score != null && (
          <div className="flex shrink-0 flex-col items-end" aria-label={`Aderência de ${talent.score}%`}>
            <span className="font-heading text-2xl font-black leading-none text-primary">{talent.score}%</span>
            <span className="text-xs text-muted-foreground">aderência</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {talent.city_name && (
          <span className="flex items-center gap-1">
            <MapPin className="size-4" /> {talent.city_name} - {talent.uf}
          </span>
        )}
        {proximity && <Badge variant={talent.band <= 2 ? "success" : "default"}>{proximity}</Badge>}
        <span>{experienceLabel(talent.experience_months)}</span>
        {talent.education_level && <span>{EDUCATION_LEVELS[talent.education_level]}</span>}
      </div>

      {talent.score != null && (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${talent.score}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {talent.total_required > 0 && (
              <Criterion
                ok={talent.matched_required === talent.total_required}
                label={`${talent.matched_required} de ${talent.total_required} habilidades exigidas`}
              />
            )}
            {talent.total_desired > 0 && (
              <Criterion ok={talent.matched_desired > 0} label={`${talent.matched_desired} de ${talent.total_desired} desejáveis`} />
            )}
            {talent.area_match != null && <Criterion ok={talent.area_match} label="Área" />}
            {talent.experience_match != null && <Criterion ok={talent.experience_match} label="Experiência" />}
            {talent.education_match != null && <Criterion ok={talent.education_match} label="Escolaridade" />}
          </div>
          {talent.matched_skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {talent.matched_skills.map((skill) => (
                <Badge key={skill} variant="success">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href} className="text-sm font-semibold text-primary hover:underline">
          Ver perfil{jobId && !talent.already_applied && !talent.invite_status ? " e convidar" : ""}
        </Link>
        {talent.already_applied && <Badge variant="navy">Já se candidatou</Badge>}
        {talent.invite_status && !talent.already_applied && <Badge variant="warning">{INVITE_STATUSES[talent.invite_status]}</Badge>}
        <form action={talent.saved ? unsaveTalent : saveTalent} className="ml-auto">
          <input type="hidden" name="resumeId" value={talent.resume_id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground hover:bg-muted"
            aria-pressed={talent.saved}
          >
            {talent.saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
            {talent.saved ? "Salvo" : "Salvar"}
          </button>
        </form>
      </div>
    </li>
  );
}
