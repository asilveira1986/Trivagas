"use client";

import { useState } from "react";
import { SkillPicker, type SelectedSkill, type SkillOption } from "@/components/jobs/skill-picker";

// Filtro de habilidades para formulários GET: guarda os ids escolhidos no campo "habilidades".
export function SkillFilter({ catalog, defaultValue }: { catalog: SkillOption[]; defaultValue: string[] }) {
  const [value, setValue] = useState<SelectedSkill[]>(defaultValue.map((id) => ({ skill_id: id, tag: "" })));
  return (
    <>
      <SkillPicker catalog={catalog} value={value} onChange={setValue} tags={[]} defaultTag="" />
      <input type="hidden" name="habilidades" value={value.map((s) => s.skill_id).join(",")} />
    </>
  );
}
