import Link from "next/link";
import { Copy, Pause, Pencil, Play, Send, Square, Trash2, Undo2 } from "lucide-react";
import { changeJobStatus, deleteDraft, duplicateJob } from "@/app/empresa/vagas/actions";
import { CopyLinkButton } from "@/components/jobs/share-buttons";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/lib/labels";
import { jobUrl } from "@/lib/links";

type Action = { status: JobStatus; label: string; icon: typeof Send; variant?: "default" | "outline" | "ghost" };

const STATUS_ACTIONS: Record<JobStatus, Action[]> = {
  draft: [{ status: "in_review", label: "Enviar para análise", icon: Send, variant: "default" }],
  in_review: [{ status: "draft", label: "Cancelar análise", icon: Undo2 }],
  rejected: [{ status: "in_review", label: "Reenviar para análise", icon: Send, variant: "default" }],
  published: [
    { status: "paused", label: "Pausar", icon: Pause },
    { status: "closed", label: "Encerrar", icon: Square },
  ],
  paused: [
    { status: "published", label: "Reativar", icon: Play, variant: "default" },
    { status: "closed", label: "Encerrar", icon: Square },
  ],
  closed: [{ status: "in_review", label: "Reabrir (nova análise)", icon: Send }],
};

export function JobActions({
  job,
  showEdit = true,
}: {
  job: { id: string; slug: string; status: JobStatus };
  showEdit?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {job.status === "published" && <CopyLinkButton url={jobUrl(job.slug)} />}
      {STATUS_ACTIONS[job.status].map((action) => (
        <form key={action.status} action={changeJobStatus}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="status" value={action.status} />
          <Button type="submit" size="sm" variant={action.variant ?? "outline"}>
            <action.icon /> {action.label}
          </Button>
        </form>
      ))}
      {showEdit && job.status !== "closed" && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/empresa/vagas/${job.id}/editar`}>
            <Pencil /> Editar
          </Link>
        </Button>
      )}
      <form action={duplicateJob}>
        <input type="hidden" name="jobId" value={job.id} />
        <Button type="submit" size="sm" variant="ghost">
          <Copy /> Duplicar
        </Button>
      </form>
      {job.status === "draft" && (
        <form action={deleteDraft}>
          <input type="hidden" name="jobId" value={job.id} />
          <Button type="submit" size="sm" variant="ghost" className="text-destructive">
            <Trash2 /> Excluir
          </Button>
        </form>
      )}
    </div>
  );
}
