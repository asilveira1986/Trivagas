import type { ReactNode } from "react";
import { AreaNav, type NavItem } from "@/components/layout/area-nav";
import type { Profile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export function AreaShell({ profile, nav, children }: { profile: Profile; nav?: NavItem[]; children: ReactNode }) {
  const firstName = profile.full_name.split(" ")[0] || "você";
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <span className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
          {ROLE_LABELS[profile.role]}
        </span>
        <p className="font-heading text-2xl font-black">Olá, {firstName}!</p>
      </div>
      {nav && <AreaNav items={nav} />}
      {children}
    </div>
  );
}

export function ComingSoonCard({ title, text, phase }: { title: string; text: string; phase: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {phase}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
