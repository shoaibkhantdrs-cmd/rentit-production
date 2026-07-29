"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIdentifier = parseIdentifier;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function parseIdentifier(raw) {
    const trimmed = raw.trim();
    return EMAIL_RE.test(trimmed)
        ? { type: "email", value: trimmed.toLowerCase() }
        : { type: "phone", value: trimmed };
}
