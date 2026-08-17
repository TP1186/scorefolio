export const SSN_REDACTION_MARKER = "[REDACTED SSN]";

// Deliberately redact every SSN-shaped value rather than attempting to decide
// whether the number was issued. A false positive is safer than allowing a
// complete identifier into derived content or a future AI request.
const COMPLETE_SSN_PATTERN = /(?<!\d)(?:\d{3}\s*[-\u2010-\u2015]\s*\d{2}\s*[-\u2010-\u2015]\s*\d{4}|\d{3}[ \t\r\n]+\d{2}[ \t\r\n]+\d{4}|\d{9})(?!\d)/g;

export type RedactedText = {
  text: string;
  redactionCount: number;
};

export function redactSocialSecurityNumbers(value: string): RedactedText {
  let redactionCount = 0;
  const text = value.replace(COMPLETE_SSN_PATTERN, () => {
    redactionCount += 1;
    return SSN_REDACTION_MARKER;
  });
  return { text, redactionCount };
}

export function containsCompleteSocialSecurityNumber(value: string) {
  COMPLETE_SSN_PATTERN.lastIndex = 0;
  return COMPLETE_SSN_PATTERN.test(value);
}
