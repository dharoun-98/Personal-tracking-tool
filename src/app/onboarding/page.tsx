import { getSupabaseServer } from "@/lib/supabase/server";
import { OnboardingEntry } from "@/components/onboarding/onboarding-entry";

export default async function OnboardingPage() {
  const supabase = await getSupabaseServer();
  if (!supabase) return <OnboardingEntry cloudWorld="signed-out" />;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return <OnboardingEntry cloudWorld="unknown" />;
  if (!user) return <OnboardingEntry cloudWorld="signed-out" />;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return <OnboardingEntry cloudWorld="unknown" />;

  return (
    <OnboardingEntry
      cloudWorld={profile.onboarding_complete ? "returning" : "new-account"}
    />
  );
}
