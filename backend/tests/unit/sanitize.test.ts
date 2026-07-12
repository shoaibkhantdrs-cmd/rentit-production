import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeBody } from "@/interfaces/http/middleware/sanitize";

function fakeReq(body: unknown) {
  return { body } as unknown as Parameters<typeof sanitizeBody>[0];
}

test("trims leading/trailing whitespace from string fields", () => {
  const req = fakeReq({ name: "  Ada Lovelace  " });
  sanitizeBody(req, {} as never, () => {});
  assert.equal((req.body as { name: string }).name, "Ada Lovelace");
});

test("strips control characters embedded in a string", () => {
  const req = fakeReq({ email: "ada@example.com" });
  sanitizeBody(req, {} as never, () => {});
  assert.equal((req.body as { email: string }).email, "ada@example.com");
});

test("recurses into nested objects and arrays", () => {
  const req = fakeReq({
    preferences: { language: "  en  " },
    tags: ["  a ", " b  "],
  });
  sanitizeBody(req, {} as never, () => {});
  const body = req.body as { preferences: { language: string }; tags: string[] };
  assert.equal(body.preferences.language, "en");
  assert.deepEqual(body.tags, ["a", "b"]);
});

test("leaves non-string values (numbers, booleans, null) untouched", () => {
  const req = fakeReq({ age: 30, active: true, note: null });
  sanitizeBody(req, {} as never, () => {});
  const body = req.body as { age: number; active: boolean; note: null };
  assert.equal(body.age, 30);
  assert.equal(body.active, true);
  assert.equal(body.note, null);
});

test("calls next() exactly once", () => {
  const req = fakeReq({ a: "b" });
  let calls = 0;
  sanitizeBody(req, {} as never, () => {
    calls += 1;
  });
  assert.equal(calls, 1);
});
