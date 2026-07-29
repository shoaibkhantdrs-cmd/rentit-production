"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpIssuer = void 0;
const AppError_1 = require("../../../domain/errors/AppError");
const PURPOSE_COPY = {
    login: { title: "Your login code", label: "log in" },
    email_verification: { title: "Verify your email", label: "verify your email" },
    phone_verification: { title: "Verify your phone", label: "verify your phone" },
    password_reset: { title: "Reset your password", label: "reset your password" },
};
/**
 * Generates, hashes, persists, and dispatches an OTP for a given purpose.
 * Shared by RegisterUser, LoginUser, ForgotPassword, and UpdateMe (phone
 * re-verification) so the "how do we send a code" logic lives in one place.
 */
class OtpIssuer {
    otpRepo;
    hasher;
    otpGenerator;
    notificationSender;
    notificationRepo;
    clock;
    config;
    constructor(otpRepo, hasher, otpGenerator, notificationSender, notificationRepo, clock, config) {
        this.otpRepo = otpRepo;
        this.hasher = hasher;
        this.otpGenerator = otpGenerator;
        this.notificationSender = notificationSender;
        this.notificationRepo = notificationRepo;
        this.clock = clock;
        this.config = config;
    }
    async issue(user, purpose) {
        const channel = purpose === "phone_verification" ? "sms" : "email";
        const destination = channel === "email" ? user.email : user.phone;
        if (!destination) {
            // Asking to phone-verify a user with no phone on file is a caller bug,
            // not a runtime/user error -- fail loudly rather than silently no-op.
            throw new AppError_1.ValidationError(`Cannot send ${channel} OTP: user has no ${channel} on file`);
        }
        const code = this.otpGenerator.generate(this.config.otpLength);
        const codeHash = await this.hasher.hash(code);
        const expiresAt = new Date(this.clock.now().getTime() + this.config.otpTtlSeconds * 1000);
        await this.otpRepo.create({
            userId: user.id,
            purpose,
            channel,
            codeHash,
            maxAttempts: this.config.otpMaxAttempts,
            expiresAt,
        });
        const copy = PURPOSE_COPY[purpose];
        // Bug fix: this call previously had no error handling at all. A
        // downstream delivery failure (wrong SMTP port/TLS mode, bad Gmail
        // App Password, DNS/network issue reaching the SMTP host, etc.) threw
        // a plain, unclassified Error straight out of SmtpClient -- which
        // propagated uncaught all the way to errorHandler.ts's generic 500
        // branch ("Something went wrong"), even though the OTP row above had
        // already been written successfully. That's indistinguishable from an
        // actual application bug in logs/monitoring and gives the caller no
        // way to know "the code exists, delivery just failed" versus "this
        // request is broken." Converting it to ServiceUnavailableError (503,
        // still >= 500 so errorHandler.ts logs it and reports it to the error
        // tracker exactly as before) with the original error's message
        // preserved in `details` keeps the real SMTP failure reason visible
        // in server-side logs while giving the client an honest, specific
        // status instead of an opaque crash.
        try {
            await this.notificationSender.send({
                channel,
                to: destination,
                subject: copy.title,
                body: `Your code to ${copy.label} is ${code}. It expires in ${Math.round(this.config.otpTtlSeconds / 60)} minutes. Do not share it with anyone.`,
            });
        }
        catch (err) {
            const cause = err instanceof Error ? err.message : String(err);
            throw new AppError_1.ServiceUnavailableError(`We couldn't send your verification code right now. Please try again in a moment.`, { channel, cause });
        }
        await this.notificationRepo.create({
            userId: user.id,
            type: `otp.${purpose}`,
            title: copy.title,
            body: `We sent a code to your ${channel === "email" ? "email" : "phone"} to ${copy.label}.`,
            data: { purpose, channel },
        });
    }
}
exports.OtpIssuer = OtpIssuer;
