"use client";

import { useActionState, useState } from "react";
import { CitySelect } from "@/components/forms/city-select";
import { Field } from "@/components/forms/field";
import { QuestionsEditor, type EditableQuestion } from "@/components/jobs/questions-editor";
import { REQUIREMENT_TAGS, SkillPicker, type SelectedSkill, type SkillOption } from "@/components/jobs/skill-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { JobFormState } from "@/app/empresa/vagas/actions";
import { AFFIRMATIVE_KINDS, CONTRACT_TYPES, EDUCATION_LEVELS, REGION_MODES, WORK_MODES, type JobStatus, type WorkMode } from "@/lib/labels";
import { usePreservingSubmit } from "@/hooks/use-preserving-submit";
import { cn } from "@/lib/utils";

export type JobFormValues = {
  title: string;
  description: string;
  areaId: string;
  contractType: string;
  workMode: WorkMode;
  city: { id: number; label: string } | null;
  salaryMin: string;
  salaryMax: string;
  benefits: string;
  positions: string;
  closesAt: string;
  regionMode: string;
  radiusKm: string;
  minEducation: string;
  minExperienceYears: string;
  affirmative: string;
  isConfidential: boolean;
  skills: SelectedSkill[];
  questions: EditableQuestion[];
};

export function JobForm({
  action,
  values,
  status,
  areas,
  skills,
  minDate,
}: {
  action: (state: JobFormState, formData: FormData) => Promise<JobFormState>;
  values: JobFormValues;
  status: JobStatus | null;
  areas: { id: string; name: string }[];
  skills: SkillOption[];
  minDate: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const onSubmit = usePreservingSubmit(formAction);
  const [workMode, setWorkMode] = useState<WorkMode>(values.workMode);
  const [selectedSkills, setSelectedSkills] = useState(values.skills);
  const [questions, setQuestions] = useState(values.questions);
  const errors = state.fieldErrors ?? {};
  const live = status === "published" || status === "paused";
  const canSubmit = status === null || status === "draft" || status === "rejected" || status === "closed";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {live && (
        <Alert>
          Alterar título, descrição ou salário devolve a vaga para análise; ela sai do ar até ser aprovada de novo.
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">A vaga</h2>
        <div className="sm:col-span-2">
          <Field id="title" label="Título" hint="Ex.: Auxiliar administrativo" errors={errors.title}>
            <Input id="title" name="title" required maxLength={120} defaultValue={values.title} aria-invalid={!!errors.title} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="description" label="Descrição" hint="Atividades, requisitos, horário e local de trabalho." errors={errors.description}>
            <Textarea
              id="description"
              name="description"
              rows={8}
              maxLength={20000}
              defaultValue={values.description}
              aria-invalid={!!errors.description}
            />
          </Field>
        </div>
        <Field id="areaId" label="Área" errors={errors.areaId}>
          <NativeSelect id="areaId" name="areaId" defaultValue={values.areaId}>
            <option value="">Selecione</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="contractType" label="Contrato" errors={errors.contractType}>
          <NativeSelect id="contractType" name="contractType" defaultValue={values.contractType}>
            {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="positions" label="Número de vagas" errors={errors.positions}>
          <Input id="positions" name="positions" type="number" min={1} max={1000} defaultValue={values.positions} />
        </Field>
        <Field id="closesAt" label="Inscrições até" hint="Opcional. A vaga encerra sozinha nesta data." errors={errors.closesAt}>
          <Input id="closesAt" name="closesAt" type="date" min={minDate} defaultValue={values.closesAt} aria-invalid={!!errors.closesAt} />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Local e região</h2>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Modalidade</legend>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(WORK_MODES).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-lg border-2 py-2.5 text-sm font-semibold",
                  workMode === value ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="workMode"
                  value={value}
                  checked={workMode === value}
                  onChange={() => setWorkMode(value as WorkMode)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {workMode === "remote" ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Vaga remota abrange candidatos de todo o Brasil, sem filtro de região.
          </p>
        ) : (
          <>
            <Field id="cityId" label="Cidade" errors={errors.cityId}>
              <CitySelect id="cityId" name="cityId" required defaultValue={values.city} invalid={!!errors.cityId} />
            </Field>
            <Field id="radiusKm" label="Raio de proximidade (km)" errors={errors.radiusKm}>
              <Input id="radiusKm" name="radiusKm" type="number" min={0} max={1000} defaultValue={values.radiusKm} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="regionMode" label="Candidatos de outras regiões" errors={errors.regionMode}>
                <NativeSelect id="regionMode" name="regionMode" defaultValue={values.regionMode}>
                  {Object.entries(REGION_MODES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </>
        )}
        {workMode === "remote" && (
          <>
            <input type="hidden" name="radiusKm" value={values.radiusKm} />
            <input type="hidden" name="regionMode" value="prioritize" />
          </>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Inclusão e sigilo</h2>
        <Field id="affirmative" label="Vaga afirmativa" hint="Opcional. Destaca a vaga para o público escolhido." errors={errors.affirmative}>
          <NativeSelect id="affirmative" name="affirmative" defaultValue={values.affirmative}>
            <option value="">Não é vaga afirmativa</option>
            {Object.entries(AFFIRMATIVE_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm sm:self-end">
          <input type="checkbox" name="isConfidential" defaultChecked={values.isConfidential} className="mt-0.5 size-4 accent-primary" />
          <span>
            <strong>Vaga confidencial</strong>
            <span className="block text-muted-foreground">
              O nome e o logotipo da empresa não aparecem no anúncio, no link nem nos e-mails aos candidatos.
            </span>
          </span>
        </label>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Remuneração e benefícios</h2>
        <Field id="salaryMin" label="Salário mínimo (R$)" hint="Opcional" errors={errors.salaryMin}>
          <Input id="salaryMin" name="salaryMin" inputMode="decimal" defaultValue={values.salaryMin} aria-invalid={!!errors.salaryMin} />
        </Field>
        <Field id="salaryMax" label="Salário máximo (R$)" hint="Opcional" errors={errors.salaryMax}>
          <Input id="salaryMax" name="salaryMax" inputMode="decimal" defaultValue={values.salaryMax} aria-invalid={!!errors.salaryMax} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="benefits" label="Benefícios" hint="Um por linha." errors={errors.benefits}>
            <Textarea id="benefits" name="benefits" rows={4} defaultValue={values.benefits} placeholder={"Vale-transporte\nVale-refeição"} />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-extrabold sm:col-span-2">Requisitos</h2>
        <Field id="minEducation" label="Escolaridade mínima" errors={errors.minEducation}>
          <NativeSelect id="minEducation" name="minEducation" defaultValue={values.minEducation}>
            <option value="">Não exigida</option>
            {Object.entries(EDUCATION_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="minExperienceYears" label="Experiência mínima (anos)" hint="Opcional" errors={errors.minExperienceYears}>
          <Input id="minExperienceYears" name="minExperienceYears" inputMode="decimal" defaultValue={values.minExperienceYears} />
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-sm font-semibold">Habilidades</span>
          {errors.skills && <p className="text-sm text-destructive">{errors.skills[0]}</p>}
          <SkillPicker
            catalog={skills}
            value={selectedSkills}
            onChange={setSelectedSkills}
            tags={REQUIREMENT_TAGS}
            defaultTag="required"
          />
          <input
            type="hidden"
            name="skills"
            value={JSON.stringify(selectedSkills.map((s) => ({ skill_id: s.skill_id, requirement: s.tag })))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Perguntas de triagem</h2>
          <p className="text-sm text-muted-foreground">Opcional. O candidato responde ao se candidatar.</p>
        </div>
        {errors.questions && <p className="text-sm text-destructive">{errors.questions[0]}</p>}
        <QuestionsEditor value={questions} onChange={setQuestions} />
        <input
          type="hidden"
          name="questions"
          value={JSON.stringify(
            questions.map(({ id, question, type, options, is_required }) => ({ id, question, type, options, is_required })),
          )}
        />
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:border-0 sm:p-0">
        {canSubmit && (
          <Button type="submit" name="intent" value="submit" disabled={pending}>
            Enviar para análise
          </Button>
        )}
        <Button type="submit" name="intent" value="draft" variant={canSubmit ? "outline" : "default"} disabled={pending}>
          {canSubmit ? "Salvar rascunho" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
