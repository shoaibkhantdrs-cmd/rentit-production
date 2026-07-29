"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpVerifier = void 0;
const AppError_1 = require("../../../domain/errors/AppError");
/**
 * Single place that implements "is this code correct, unexpired, and
 * under the attempt limit" -- used by both VerifyOtp (login/email/phone)
 * and ResetPassword (password_reset), so the anti-brute-force rules can't
 * drift between the two call sites.
 */
class OtpVerifier {
    otpRepo;
    hasher;
    clock;
    constructor(otpRepo, hasher, clock) {
        this.otpRepo = otpRepo;
        this.hasher = hasher;
        this.clock = clock;
    }
    async verifyAndConsume(userId, purpose, code) {
        const otp = await this.otpRepo.findActive(userId, purpose);
        if (!otp) {
            throw new AppError_1.UnauthorizedError("Invalid or expired code");
        }
        if (otp.attempts >= otp.maxAttempts) {
            throw new AppError_1.TooManyRequestsError("Too many incorrect attempts. Request a new code.");
        }
        if (otp.expiresAt.getTime() < this.clock.now().getTime()) {
            throw new AppError_1.UnauthorizedError("Invalid or expired code");
        }
        const isMatch = await this.hasher.verify(code, otp.codeHash);
        if (!isMatch) {
            await this.otpRepo.incrementAttempts(otp.id);
            throw new AppError_1.UnauthorizedError("Invalid or expired code");
        }
        await this.otpRepo.consume(otp.id);
    }
}
exports.OtpVerifier = OtpVerifier;
