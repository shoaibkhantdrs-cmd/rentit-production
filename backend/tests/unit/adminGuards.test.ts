import { test } from "node:test";
import assert from "node:assert/strict";
import { assertCanModerateUser } from "@/application/admin/shared/adminGuards";
import { ForbiddenError } from "@/domain/errors/AppError";

test("assertCanModerateUser: allows a plain admin to moderate a non-super_admin", () => {
  assert.doesNotThrow(() => assertCanModerateUser(["customer"], ["admin"]));
  assert.doesNotThrow(() => assertCanModerateUser(["property_owner"], ["admin"]));
});

test("assertCanModerateUser: blocks a plain admin from moderating a super_admin", () => {
  assert.throws(() => assertCanModerateUser(["super_admin"], ["admin"]), ForbiddenError);
});

test("assertCanModerateUser: allows a super_admin to moderate another super_admin", () => {
  assert.doesNotThrow(() => assertCanModerateUser(["super_admin"], ["super_admin"]));
});
