import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "@/interfaces/http/middleware/authorize";

function fakeReq(user?: { sub: string; roles: string[]; sessionId: string }) {
  return { user } as unknown as Parameters<ReturnType<typeof authorize>>[0];
}

test("calls next() with no error when the user has an allowed role", () => {
  const middleware = authorize("admin", "super_admin");
  const req = fakeReq({ sub: "u1", roles: ["admin"], sessionId: "s1" });
  let receivedError: unknown = "not-called";
  middleware(req, {} as never, (err) => {
    receivedError = err;
  });
  assert.equal(receivedError, undefined);
});

test("calls next(ForbiddenError) when the user lacks any allowed role", () => {
  const middleware = authorize("admin", "super_admin");
  const req = fakeReq({ sub: "u1", roles: ["customer"], sessionId: "s1" });
  let receivedError: Error | undefined;
  middleware(req, {} as never, (err) => {
    receivedError = err as Error;
  });
  assert.equal(receivedError?.constructor.name, "ForbiddenError");
});

test("calls next(UnauthorizedError) when there is no authenticated user at all", () => {
  const middleware = authorize("admin");
  const req = fakeReq(undefined);
  let receivedError: Error | undefined;
  middleware(req, {} as never, (err) => {
    receivedError = err as Error;
  });
  assert.equal(receivedError?.constructor.name, "UnauthorizedError");
});

test("allows a user whose roles include just one of several allowed roles", () => {
  const middleware = authorize("admin", "super_admin", "moderator");
  const req = fakeReq({ sub: "u1", roles: ["customer", "moderator"], sessionId: "s1" });
  let receivedError: unknown = "not-called";
  middleware(req, {} as never, (err) => {
    receivedError = err;
  });
  assert.equal(receivedError, undefined);
});
