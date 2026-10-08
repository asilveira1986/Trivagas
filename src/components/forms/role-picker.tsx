"use client";

import { Building2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type SignupRole = "candidate" | "company";

const OPTIONS = [
  { value: "candidate", icon: UserRound, title: "Busco emprego", text: "Crie seu currículo e candidate-se" },
  { value: "company", icon: Building2, title: "Sou empresa", text: "Publique vagas e receba candidatos" },
] as const;

export function RolePicker({ value, onChange }: { value: SignupRole; onChange: (role: SignupRole) => void }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="sr-only">Tipo de conta</legend>
      {OPTIONS.map(({ value: option, icon: Icon, title, text }) => (
        <label
          key={option}
          className={cn(
            "flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors",
            value === option ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          )}
        >
          <input
            type="radio"
            name="role"
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          <Icon className={cn("size-5", value === option ? "text-primary" : "text-muted-foreground")} />
          <span className="font-heading font-extrabold">{title}</span>
          <span className="text-xs text-muted-foreground">{text}</span>
        </label>
      ))}
    </fieldset>
  );
}
