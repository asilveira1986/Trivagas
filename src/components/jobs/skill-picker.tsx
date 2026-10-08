"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SkillOption = { id: string; name: string };
export type SelectedSkill = { skill_id: string; tag: string };
export type SkillTag = { value: string; label: string; activeClassName: string };

export const REQUIREMENT_TAGS: SkillTag[] = [
  { value: "required", label: "Exigida", activeClassName: "bg-primary text-primary-foreground" },
  { value: "desired", label: "Desejável", activeClassName: "bg-secondary text-secondary-foreground" },
];

export const LEVEL_TAGS: SkillTag[] = [
  { value: "basic", label: "Básico", activeClassName: "bg-secondary text-secondary-foreground" },
  { value: "intermediate", label: "Intermediário", activeClassName: "bg-secondary text-secondary-foreground" },
  { value: "advanced", label: "Avançado", activeClassName: "bg-primary text-primary-foreground" },
];

const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function SkillPicker({
  catalog,
  value,
  onChange,
  tags,
  defaultTag,
}: {
  catalog: SkillOption[];
  value: SelectedSkill[];
  onChange: (value: SelectedSkill[]) => void;
  tags: SkillTag[];
  defaultTag: string;
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
              <span className="flex flex-wrap items-center justify-end gap-1">
                {tags.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    aria-pressed={skill.tag === tag.value}
                    onClick={() => onChange(value.map((s) => (s.skill_id === skill.skill_id ? { ...s, tag: tag.value } : s)))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      skill.tag === tag.value ? tag.activeClassName : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tag.label}
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
              onChange([...value, { skill_id: skill.id, tag: defaultTag }]);
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
