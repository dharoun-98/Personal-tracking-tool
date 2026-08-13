export type CloudWorldState =
  | "signed-out"
  | "new-account"
  | "returning"
  | "unknown";

export type OnboardingEntryState = "dashboard" | "onboarding" | "blocked";

/** Pure decision used at the boundary between server identity and local data. */
export function resolveOnboardingEntry(
  cloudWorld: CloudWorldState,
  localWorldComplete: boolean,
): OnboardingEntryState {
  if (localWorldComplete || cloudWorld === "returning") return "dashboard";
  if (cloudWorld === "unknown") return "blocked";
  return "onboarding";
}
