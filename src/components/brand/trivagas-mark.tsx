import { cn } from "@/lib/utils";

// Símbolo "T" em faixas verde, vermelha e amarela.
// Provisório: substituir pelo vetor original do logotipo quando for enviado.
export function TrivagasMark({ className, title = "Trivagas" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title} className={cn("size-8", className)}>
      <rect x="4" y="6" width="56" height="12" rx="4" fill="var(--brand-green)" />
      <rect x="4" y="21" width="56" height="10" rx="4" fill="var(--brand-red)" />
      <rect x="24" y="34" width="16" height="26" rx="4" fill="var(--brand-yellow)" />
    </svg>
  );
}

export function TrivagasLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <TrivagasMark className="size-8" title="" />
      <span className="font-heading text-2xl font-black tracking-tight text-brand-navy">
        TRI<span className="text-brand-navy">Vagas</span>
      </span>
    </span>
  );
}
