"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const authorize_1 = require("@/interfaces/http/middleware/authorize");
function fakeReq(user) {
    return { user };
}
(0, node_test_1.default)("calls next() with no error when the user has an allowed role", () => {
    const middleware = (0, authorize_1.authorize)("admin", "super_admin");
    const req = fakeReq({ sub: "u1", roles: ["admin"], sessionId: "s1" });
    let receivedError = "not-called";
    middleware(req, {}, (err) => {
        receivedError = err;
    });
    strict_1.default.equal(receivedError, undefined);
});
(0, node_test_1.default)("calls next(ForbiddenError) when the user lacks any allowed role", () => {
    const middleware = (0, authorize_1.authorize)("admin", "super_admin");
    const req = fakeReq({ sub: "u1", roles: ["customer"], sessionId: "s1" });
    let receivedError;
    middleware(req, {}, (err) => {
        receivedError = err;
    });
    strict_1.default.equal(receivedError?.constructor.name, "ForbiddenError");
});
(0, node_test_1.default)("calls next(UnauthorizedError) when there is no authenticated user at all", () => {
    const middleware = (0, authorize_1.authorize)("admin");
    const req = fakeReq(undefined);
    let receivedError;
    middleware(req, {}, (err) => {
        receivedError = err;
    });
    strict_1.default.equal(receivedError?.constructor.name, "UnauthorizedError");
});
(0, node_test_1.default)("allows a user whose roles include just one of several allowed roles", () => {
    const middleware = (0, authorize_1.authorize)("admin", "super_admin", "moderator");
    const req = fakeReq({ sub: "u1", roles: ["customer", "moderator"], sessionId: "s1" });
    let receivedError = "not-called";
    middleware(req, {}, (err) => {
        receivedError = err;
    });
    strict_1.default.equal(receivedError, undefined);
});
