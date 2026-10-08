import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, className }: { value: number | null; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={value ? `Nota ${value} de 5` : "Sem nota"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", value && n <= value ? "fill-accent text-accent" : "text-border")} />
      ))}
    </span>
  );
}
