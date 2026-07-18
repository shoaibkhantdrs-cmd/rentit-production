"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeOtpGenerator = void 0;
/** Returns a fixed, predictable code so tests can assert on it directly. */
class FakeOtpGenerator {
    fixedCode;
    constructor(fixedCode = "123456") {
        this.fixedCode = fixedCode;
    }
    generate(_length) {
        return this.fixedCode;
    }
}
exports.FakeOtpGenerator = FakeOtpGenerator;
