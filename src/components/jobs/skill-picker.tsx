"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SkillOption = { id: string; name: string };
export type SelectedSkill = { skill_id: string; requirement: "required" | "desired" };

const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function SkillPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: SkillOption[];
  value: SelectedSkill[];
  onChange: (value: SelectedSkill[]) => void;
}) {
  const [query, setQuery] = useState("");
  const names = useMemo(() => new Map(catalog.map((skill) => [skill.id, skill.name])), [catalog]);
  const selectedIds = new Set(value.map((skill) => skill.skill_id));
  const suggestions = catalog
    .filter((skill) => !selectedIds.has(skill.id) && normalize(skill.name).includes(normalize(query.trim())))
    .slice(0, query.trim() ? 12 : 8);

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.map((skill) => (
            <li key={skill.skill_id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <span className="text-sm font-semibold">{names.get(skill.skill_id)}</span>
              <span className="flex items-center gap-1">
                {(["required", "desired"] as const).map((requirement) => (
                  <button
                    key={requirement}
                    type="button"
                    onClick={() =>
                      onChange(value.map((s) => (s.skill_id === skill.skill_id ? { ...s, requirement } : s)))
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      skill.requirement === requirement
                        ? requirement === "required"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {requirement === "required" ? "Exigida" : "Desejável"}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label={`Remover ${names.get(skill.skill_id)}`}
                  onClick={() => onChange(value.filter((s) => s.skill_id !== skill.skill_id))}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Input placeholder="Buscar habilidade" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        {suggestions.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => {
              onChange([...value, { skill_id: skill.id, requirement: "required" }]);
              setQuery("");
            }}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:border-primary hover:text-primary"
          >
            <Plus className="size-3.5" /> {skill.name}
          </button>
        ))}
        {suggestions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma habilidade encontrada.</p>}
      </div>
    </div>
  );
}
