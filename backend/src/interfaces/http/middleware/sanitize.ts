import { NextFunction, Request, Response } from "express";

// Matches C0 control characters and DEL, expressed via escapes (not raw
// bytes) so the source file itself stays plain ASCII text. The whole point
// of this regex is to match control characters, so it deliberately
// disables eslint's no-control-regex rule rather than working around it.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(CONTROL_CHARS, "").trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = sanitizeValue(val);
    }
    return result;
  }
  return value;
}

/**
 * Strips control characters and trims whitespace from every string in the
 * request body, recursively. Runs before zod validation so schemas see
 * already-clean input. This is not HTML/SQL sanitization (queries are
 * parameterized everywhere; responses are JSON, not rendered HTML) -- its
 * job is specifically to stop stray control bytes and padding whitespace
 * from silently corrupting things like email/OTP comparisons.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
}
