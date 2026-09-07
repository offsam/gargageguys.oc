import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMetaInboxLeadFormText,
  parseMetaInboxLeadFormText,
} from "@/lib/leads/meta-inbox-parse";

describe("parseMetaInboxLeadFormText", () => {
  const sample = [
    "Hello! I filled out your form and would like to know more about your business.",
    "First name: Greg boden",
    "Phone number: (562) 706-3272",
    "Zip code: 92630",
    "What do you need help with?: Replacing an old opener",
    "Email:",
  ].join("\n");

  it("detects Meta inbox lead forms", () => {
    assert.equal(isMetaInboxLeadFormText(sample), true);
    assert.equal(isMetaInboxLeadFormText("hi there"), false);
  });

  it("parses Greg Boden sample", () => {
    const parsed = parseMetaInboxLeadFormText(sample);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.name, "Greg boden");
    assert.match(parsed.phone, /562/);
    assert.equal(parsed.zip, "92630");
    assert.match(parsed.message, /opener/i);
  });
});
