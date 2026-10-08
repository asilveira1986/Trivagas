import { Badge } from "@/components/ui/badge";
import { APPLICATION_STAGES, CANDIDATE_STAGES, type ApplicationStage } from "@/lib/labels";

const VARIANT = {
  new: "warning",
  reviewing: "navy",
  interview: "success",
  approved: "success",
  rejected: "default",
} as const;

export function StageBadge({ stage, audience }: { stage: ApplicationStage; audience: "company" | "candidate" }) {
  const labels = audience === "company" ? APPLICATION_STAGES : CANDIDATE_STAGES;
  return <Badge variant={VARIANT[stage]}>{labels[stage]}</Badge>;
}
