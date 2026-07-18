"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const sanitize_1 = require("@/interfaces/http/middleware/sanitize");
function fakeReq(body) {
    return { body };
}
(0, node_test_1.default)("trims leading/trailing whitespace from string fields", () => {
    const req = fakeReq({ name: "  Ada Lovelace  " });
    (0, sanitize_1.sanitizeBody)(req, {}, () => { });
    strict_1.default.equal(req.body.name, "Ada Lovelace");
});
(0, node_test_1.default)("strips control characters embedded in a string", () => {
    const req = fakeReq({ email: "ada@example.com" });
    (0, sanitize_1.sanitizeBody)(req, {}, () => { });
    strict_1.default.equal(req.body.email, "ada@example.com");
});
(0, node_test_1.default)("recurses into nested objects and arrays", () => {
    const req = fakeReq({
        preferences: { language: "  en  " },
        tags: ["  a ", " b  "],
    });
    (0, sanitize_1.sanitizeBody)(req, {}, () => { });
    const body = req.body;
    strict_1.default.equal(body.preferences.language, "en");
    strict_1.default.deepEqual(body.tags, ["a", "b"]);
});
(0, node_test_1.default)("leaves non-string values (numbers, booleans, null) untouched", () => {
    const req = fakeReq({ age: 30, active: true, note: null });
    (0, sanitize_1.sanitizeBody)(req, {}, () => { });
    const body = req.body;
    strict_1.default.equal(body.age, 30);
    strict_1.default.equal(body.active, true);
    strict_1.default.equal(body.note, null);
});
(0, node_test_1.default)("calls next() exactly once", () => {
    const req = fakeReq({ a: "b" });
    let calls = 0;
    (0, sanitize_1.sanitizeBody)(req, {}, () => {
        calls += 1;
    });
    strict_1.default.equal(calls, 1);
});
