import { Badge } from "@/components/ui/badge";
import { COMPANY_STATUSES, JOB_STATUSES, type CompanyStatus, type JobStatus } from "@/lib/labels";

const JOB_VARIANT = {
  draft: "default",
  in_review: "warning",
  published: "success",
  paused: "navy",
  closed: "default",
  rejected: "danger",
} as const;

const COMPANY_VARIANT = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  blocked: "danger",
} as const;

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={JOB_VARIANT[status]}>{JOB_STATUSES[status]}</Badge>;
}

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return <Badge variant={COMPANY_VARIANT[status]}>{COMPANY_STATUSES[status]}</Badge>;
}
