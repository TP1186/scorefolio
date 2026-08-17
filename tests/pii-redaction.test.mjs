import assert from "node:assert/strict";
import test from "node:test";
import {
  containsCompleteSocialSecurityNumber,
  redactSocialSecurityNumbers,
  SSN_REDACTION_MARKER,
} from "../lib/pii-redaction.ts";

test("complete SSN shapes are fully redacted without retaining digits", () => {
  const result = redactSocialSecurityNumbers(
    "Synthetic values: 987-65-4321, 987 65 4321, and 987654321.",
  );

  assert.equal(result.redactionCount, 3);
  assert.equal(result.text, `Synthetic values: ${SSN_REDACTION_MARKER}, ${SSN_REDACTION_MARKER}, and ${SSN_REDACTION_MARKER}.`);
  assert.equal(containsCompleteSocialSecurityNumber(result.text), false);
});

test("PDF and OCR separator variants are redacted", () => {
  const result = redactSocialSecurityNumbers("987 - 65 - 4321\n987-\n65-4321\n987\n65\n4321");

  assert.equal(result.redactionCount, 3);
  assert.equal(containsCompleteSocialSecurityNumber(result.text), false);
});

test("longer numeric identifiers and incomplete values are not partially redacted", () => {
  const value = "12345678 1234567890 12-345-6789 123-45-678";
  const result = redactSocialSecurityNumbers(value);

  assert.equal(result.redactionCount, 0);
  assert.equal(result.text, value);
});

test("multiple calls do not share regular-expression state", () => {
  assert.equal(containsCompleteSocialSecurityNumber("987-65-4321"), true);
  assert.equal(containsCompleteSocialSecurityNumber("privacy-safe TEST-001"), false);
  assert.equal(containsCompleteSocialSecurityNumber("987654321"), true);
});
