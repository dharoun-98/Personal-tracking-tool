import assert from "node:assert/strict";
import test from "node:test";
import { resolveOnboardingEntry } from "../src/lib/onboarding-entry-state.ts";

test("a returning account opens the dashboard for cloud restore", () => {
  assert.equal(resolveOnboardingEntry("returning", false), "dashboard");
});

test("a positively new signed-in account can complete onboarding", () => {
  assert.equal(resolveOnboardingEntry("new-account", false), "onboarding");
});

test("an uncertain cloud lookup fails safe instead of creating a second world", () => {
  assert.equal(resolveOnboardingEntry("unknown", false), "blocked");
});

test("an existing local world always opens instead of restarting setup", () => {
  for (const state of ["signed-out", "new-account", "returning", "unknown"]) {
    assert.equal(resolveOnboardingEntry(state, true), "dashboard", state);
  }
});
