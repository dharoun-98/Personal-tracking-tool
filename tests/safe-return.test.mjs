import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalReturnPath } from "../src/lib/safe-return.ts";

test("accepts local paths with query strings and hashes", () => {
  assert.equal(safeInternalReturnPath("/dashboard"), "/dashboard");
  assert.equal(
    safeInternalReturnPath("/quests/new?domain=health&returnTo=%2Fmap#custom"),
    "/quests/new?domain=health&returnTo=%2Fmap#custom",
  );
});

test("rejects destinations that can escape the application", () => {
  const unsafe = [
    "//evil.example/path",
    "/\\evil.example/path",
    "/%5Cevil.example/path",
    "https://evil.example/path",
    "javascript:alert(1)",
  ];

  for (const value of unsafe) {
    assert.equal(safeInternalReturnPath(value), "/dashboard", value);
  }
});

test("rejects raw and encoded control characters", () => {
  const unsafe = [
    "/dashboard\n//evil.example",
    "/dashboard\u0000next",
    "/dashboard?next=%0Aevil.example",
  ];

  for (const value of unsafe) {
    assert.equal(safeInternalReturnPath(value), "/dashboard", value);
  }
});

test("validates a caller-provided fallback", () => {
  assert.equal(safeInternalReturnPath(null, "/profile?from=auth"), "/profile?from=auth");
  assert.equal(safeInternalReturnPath(null, "//evil.example"), "/dashboard");
});
