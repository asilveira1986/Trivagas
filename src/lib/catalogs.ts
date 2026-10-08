import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

export async function getJobCatalogs() {
  const supabase = createPublicClient();
  const [{ data: areas }, { data: skills }] = await Promise.all([
    supabase.from("areas").select("id, name").eq("active", true).order("name"),
    supabase.from("skills").select("id, name").eq("active", true).order("name"),
  ]);
  return {
    areas: (areas ?? []) as { id: string; name: string }[],
    skills: (skills ?? []) as { id: string; name: string }[],
  };
}
