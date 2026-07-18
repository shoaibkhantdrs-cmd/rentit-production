"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const adminGuards_1 = require("@/application/admin/shared/adminGuards");
const AppError_1 = require("@/domain/errors/AppError");
(0, node_test_1.test)("assertCanModerateUser: allows a plain admin to moderate a non-super_admin", () => {
    strict_1.default.doesNotThrow(() => (0, adminGuards_1.assertCanModerateUser)(["customer"], ["admin"]));
    strict_1.default.doesNotThrow(() => (0, adminGuards_1.assertCanModerateUser)(["property_owner"], ["admin"]));
});
(0, node_test_1.test)("assertCanModerateUser: blocks a plain admin from moderating a super_admin", () => {
    strict_1.default.throws(() => (0, adminGuards_1.assertCanModerateUser)(["super_admin"], ["admin"]), AppError_1.ForbiddenError);
});
(0, node_test_1.test)("assertCanModerateUser: allows a super_admin to moderate another super_admin", () => {
    strict_1.default.doesNotThrow(() => (0, adminGuards_1.assertCanModerateUser)(["super_admin"], ["super_admin"]));
});
