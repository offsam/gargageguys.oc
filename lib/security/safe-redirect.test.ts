import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeInternalPath } from "./safe-redirect.ts";
import { sanitizeIlikeFragment } from "./sanitize.ts";

describe("safeInternalPath", () => {
  it("allows same-origin paths", () => {
    assert.equal(safeInternalPath("/finance", "/owner"), "/finance");
    assert.equal(safeInternalPath("/field/jobs/1", "/field"), "/field/jobs/1");
  });

  it("blocks protocol-relative and external-looking next", () => {
    assert.equal(safeInternalPath("//evil.com", "/owner"), "/owner");
    assert.equal(safeInternalPath("https://evil.com", "/owner"), "/owner");
    assert.equal(safeInternalPath("\\evil", "/owner"), "/owner");
    assert.equal(safeInternalPath("", "/owner"), "/owner");
  });
});

describe("sanitizeIlikeFragment", () => {
  it("strips PostgREST filter metacharacters", () => {
    assert.equal(sanitizeIlikeFragment("Sam, (test).%\\"), "Sam test");
    assert.equal(sanitizeIlikeFragment("ab"), "ab");
  });
});
