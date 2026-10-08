"use server";

import { redirect } from "next/navigation";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { safeNextPath } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, type FieldErrors } from "@/lib/validation/auth";

export type OnboardingState = { fieldErrors?: FieldErrors; error?: string };

export async function completeOnboarding(_: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    chosen_role: parsed.data.role,
    chosen_name: parsed.data.fullName,
    chosen_city: parsed.data.cityId,
    chosen_phone: parsed.data.phone,
    accepted_terms_version: TERMS_VERSION,
    accepted_privacy_version: PRIVACY_VERSION,
  });

  if (error && !error.message.includes("já concluído")) {
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
