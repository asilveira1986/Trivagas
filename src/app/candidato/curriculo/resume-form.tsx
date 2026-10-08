"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CitySelect } from "@/components/forms/city-select";
import { Field } from "@/components/forms/field";
import { LEVEL_TAGS, SkillPicker, type SelectedSkill, type SkillOption } from "@/components/jobs/skill-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { EDUCATION_LEVELS, LANGUAGE_LEVELS, type EducationLevel, type LanguageLevel } from "@/lib/labels";
import { saveResume, type ResumeFormState } from "../actions";

export type ExperienceItem = {
  key: string;
  company_name: string;
  role_title: string;
  started_on: string;
  ended_on: string;
  is_current: boolean;
  activities: string;
};

export type EducationItem = {
  key: string;
  course: string;
  institution: string;
  level: EducationLevel | "";
  is_course: boolean;
  started_on: string;
  ended_on: string;
  is_current: boolean;
};

export type LanguageItem = { key: string; language: string; level: LanguageLevel };

export type ResumeFormValues = {
  fullName: string;
  phone: string;
  city: { id: number; label: string } | null;
  headline: string;
  objective: string;
  areaId: string;
  educationLevel: string;
  desiredSalary: string;
  searchRadiusKm: string;
  experiences: ExperienceItem[];
  education: EducationItem[];
  languages: LanguageItem[];
  skills: SelectedSkill[];
};

const newKey = () => crypto.randomUUID();

function ListError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="text-sm text-destructive">{errors[0]}</p> : null;
}

export function ResumeForm({
  values,
  areas,
  skills,
}: {
  values: ResumeFormValues;
  areas: { id: string; name: string }[];
  skills: SkillOption[];
}) {
  const [state, formAction, pending] = useActionState<ResumeFormState, FormData>(saveResume, {});
  const onSubmit = usePreservingSubmit(formAction);
  const [experiences, setExperiences] = useState(values.experiences);
  const [education, setEducation] = useState(values.education);
  const [languages, setLanguages] = useState(values.languages);
  const [selectedSkills, setSelectedSkills] = useState(values.skills);
  const errors = state.fieldErrors ?? {};

  const updateExperience = (key: string, patch: Partial<ExperienceItem>) =>
    setExperiences((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const updateEducation = (key: string, patch: Partial<EducationItem>) =>
    setEducation((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.saved && <Alert variant="success">Currículo salvo.</Alert>}

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Dados pessoais</h2>
        <Field id="fullName" label="Nome completo" errors={errors.fullName}>
          <Input id="fullName" name="fullName" autoComplete="name" defaultValue={values.fullName} aria-invalid={!!errors.fullName} />
        </Field>
        <Field id="phone" label="WhatsApp" errors={errors.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={values.phone} aria-invalid={!!errors.phone} />
        </Field>
        <Field id="cityId" label="Cidade" errors={errors.cityId}>
          <CitySelect id="cityId" name="cityId" defaultValue={values.city} invalid={!!errors.cityId} />
        </Field>
        <Field id="searchRadiusKm" label="Busco vagas num raio de (km)" errors={errors.searchRadiusKm}>
          <Input id="searchRadiusKm" name="searchRadiusKm" type="number" min={0} max={1000} defaultValue={values.searchRadiusKm} />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Perfil profissional</h2>
        <div className="sm:col-span-2">
          <Field id="headline" label="Título profissional" hint="Ex.: Auxiliar administrativa com experiência em atendimento" errors={errors.headline}>
            <Input id="headline" name="headline" maxLength={120} defaultValue={values.headline} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="objective" label="Objetivo e resumo" errors={errors.objective}>
            <Textarea id="objective" name="objective" rows={4} maxLength={2000} defaultValue={values.objective} />
          </Field>
        </div>
        <Field id="areaId" label="Área de interesse" errors={errors.areaId}>
          <NativeSelect id="areaId" name="areaId" defaultValue={values.areaId}>
            <option value="">Selecione</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="educationLevel" label="Escolaridade" errors={errors.educationLevel}>
          <NativeSelect id="educationLevel" name="educationLevel" defaultValue={values.educationLevel}>
            <option value="">Selecione</option>
            {Object.entries(EDUCATION_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="desiredSalary" label="Pretensão salarial (R$)" hint="Opcional" errors={errors.desiredSalary}>
          <Input id="desiredSalary" name="desiredSalary" inputMode="decimal" defaultValue={values.desiredSalary} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Experiência profissional</h2>
        <ListError errors={errors.experiences} />
        {experiences.map((item, index) => (
          <fieldset key={item.key} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <legend className="sr-only">Experiência {index + 1}</legend>
            <Input aria-label="Cargo" placeholder="Cargo" value={item.role_title} onChange={(e) => updateExperience(item.key, { role_title: e.target.value })} />
            <Input aria-label="Empresa" placeholder="Empresa" value={item.company_name} onChange={(e) => updateExperience(item.key, { company_name: e.target.value })} />
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Entrada
              <Input type="month" value={item.started_on} onChange={(e) => updateExperience(item.key, { started_on: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Saída
              <Input type="month" value={item.ended_on} disabled={item.is_current} onChange={(e) => updateExperience(item.key, { ended_on: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-primary" checked={item.is_current} onChange={(e) => updateExperience(item.key, { is_current: e.target.checked })} />
              Trabalho aqui atualmente
            </label>
            <Textarea
              aria-label="Atividades"
              placeholder="Principais atividades e resultados"
              rows={3}
              maxLength={3000}
              className="sm:col-span-2"
              value={item.activities}
              onChange={(e) => updateExperience(item.key, { activities: e.target.value })}
            />
            <Button type="button" variant="ghost" size="sm" className="w-fit text-destructive" onClick={() => setExperiences((list) => list.filter((e) => e.key !== item.key))}>
              <Trash2 /> Remover experiência
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setExperiences((list) => [
              ...list,
              { key: newKey(), company_name: "", role_title: "", started_on: "", ended_on: "", is_current: false, activities: "" },
            ])
          }
        >
          <Plus /> Adicionar experiência
        </Button>
        <input
          type="hidden"
          name="experiences"
          value={JSON.stringify(experiences.map((item) => ({ ...item, key: undefined })))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Formação e cursos</h2>
        <ListError errors={errors.education} />
        {education.map((item, index) => (
          <fieldset key={item.key} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <legend className="sr-only">Formação {index + 1}</legend>
            <Input aria-label="Curso" placeholder="Curso" value={item.course} onChange={(e) => updateEducation(item.key, { course: e.target.value })} />
            <Input aria-label="Instituição" placeholder="Instituição" value={item.institution} onChange={(e) => updateEducation(item.key, { institution: e.target.value })} />
            <NativeSelect aria-label="Nível" value={item.level} onChange={(e) => updateEducation(item.key, { level: e.target.value as EducationLevel })}>
              <option value="">Nível</option>
              {Object.entries(EDUCATION_LEVELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={item.is_course} onChange={(e) => updateEducation(item.key, { is_course: e.target.checked })} />
              Curso livre ou complementar
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Início
              <Input type="month" value={item.started_on} onChange={(e) => updateEducation(item.key, { started_on: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Conclusão
              <Input type="month" value={item.ended_on} disabled={item.is_current} onChange={(e) => updateEducation(item.key, { ended_on: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-primary" checked={item.is_current} onChange={(e) => updateEducation(item.key, { is_current: e.target.checked })} />
              Em andamento
            </label>
            <Button type="button" variant="ghost" size="sm" className="w-fit text-destructive" onClick={() => setEducation((list) => list.filter((e) => e.key !== item.key))}>
              <Trash2 /> Remover
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setEducation((list) => [
              ...list,
              { key: newKey(), course: "", institution: "", level: "", is_course: false, started_on: "", ended_on: "", is_current: false },
            ])
          }
        >
          <Plus /> Adicionar formação ou curso
        </Button>
        <input
          type="hidden"
          name="education"
          value={JSON.stringify(education.map((item) => ({ ...item, key: undefined })))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Habilidades</h2>
        <ListError errors={errors.skills} />
        <SkillPicker catalog={skills} value={selectedSkills} onChange={setSelectedSkills} tags={LEVEL_TAGS} defaultTag="intermediate" />
        <input
          type="hidden"
          name="skills"
          value={JSON.stringify(selectedSkills.map((s) => ({ skill_id: s.skill_id, level: s.tag })))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Idiomas</h2>
        <ListError errors={errors.languages} />
        {languages.map((item) => (
          <div key={item.key} className="grid grid-cols-[1fr_150px_auto] gap-2">
            <Input
              aria-label="Idioma"
              placeholder="Idioma"
              value={item.language}
              onChange={(e) => setLanguages((list) => list.map((l) => (l.key === item.key ? { ...l, language: e.target.value } : l)))}
            />
            <NativeSelect
              aria-label="Nível"
              value={item.level}
              onChange={(e) =>
                setLanguages((list) => list.map((l) => (l.key === item.key ? { ...l, level: e.target.value as LanguageLevel } : l)))
              }
            >
              {Object.entries(LANGUAGE_LEVELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover ${item.language || "idioma"}`}
              onClick={() => setLanguages((list) => list.filter((l) => l.key !== item.key))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setLanguages((list) => [...list, { key: newKey(), language: "", level: "basic" }])}
        >
          <Plus /> Adicionar idioma
        </Button>
        <input
          type="hidden"
          name="languages"
          value={JSON.stringify(languages.map(({ language, level }) => ({ language, level })))}
        />
      </section>

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:p-0">
        <Button type="submit" disabled={pending} className="w-full sm:w-fit">
          {pending ? "Salvando…" : "Salvar currículo"}
        </Button>
      </div>
    </form>
  );
}
