const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Identifier = { type: "email"; value: string } | { type: "phone"; value: string };

export function parseIdentifier(raw: string): Identifier {
  const trimmed = raw.trim();
  return EMAIL_RE.test(trimmed)
    ? { type: "email", value: trimmed.toLowerCase() }
    : { type: "phone", value: trimmed };
}
