import Image from "next/image";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatSalary } from "@/lib/format";
import { AFFIRMATIVE_KINDS, CONTRACT_TYPES, WORK_MODES } from "@/lib/labels";
import { jobPath, logoUrl } from "@/lib/links";
import type { PublicJob } from "@/lib/public-jobs";

export function JobCard({ job }: { job: PublicJob }) {
  const logo = logoUrl(job.logo_path);
  const salary = formatSalary(job.salary_min, job.salary_max);
  return (
    <li>
      <Link href={jobPath(job.slug)} className="flex gap-3 rounded-xl border p-4 transition-colors hover:border-primary">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
          {logo ? (
            <Image src={logo} alt="" width={48} height={48} className="size-full object-contain" unoptimized />
          ) : (
            <Building2 className="size-5 text-muted-foreground" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-lg font-extrabold leading-tight">{job.title}</span>
          <span className="text-sm text-muted-foreground">{job.company_name}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-4" />
              {job.work_mode === "remote" ? "Remoto (todo o Brasil)" : `${job.city_name} - ${job.uf}`}
              {job.distance_km != null &&
                job.work_mode !== "remote" &&
                (job.distance_km < 1 ? " · na mesma cidade" : ` · ${Math.round(job.distance_km)} km`)}
            </span>
            <span>
              {CONTRACT_TYPES[job.contract_type]}
              {job.work_mode !== "remote" && ` · ${WORK_MODES[job.work_mode]}`}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {job.affirmative && <Badge variant="warning">Afirmativa: {AFFIRMATIVE_KINDS[job.affirmative]}</Badge>}
            {salary && <Badge variant="success">{salary}</Badge>}
            publicada em {formatDate(job.published_at)}
          </span>
        </span>
      </Link>
    </li>
  );
}
