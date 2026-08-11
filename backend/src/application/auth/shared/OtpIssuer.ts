import { IOtpRepository } from "@/domain/repositories/IOtpRepository";
import { IHasher } from "@/domain/services/IHasher";
import { IOtpGenerator } from "@/domain/services/IOtpGenerator";
import { INotificationSender } from "@/domain/services/INotificationSender";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IClock } from "@/domain/services/IClock";
import { AuthConfig } from "@/application/dtos/AuthConfig";
import { OtpPurpose } from "@/domain/entities/OtpCode";
import { User } from "@/domain/entities/User";
import { ServiceUnavailableError, ValidationError } from "@/domain/errors/AppError";

const PURPOSE_COPY: Record<OtpPurpose, { title: string; label: string }> = {
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
export class OtpIssuer {
  constructor(
    private readonly otpRepo: IOtpRepository,
    private readonly hasher: IHasher,
    private readonly otpGenerator: IOtpGenerator,
    private readonly notificationSender: INotificationSender,
    private readonly notificationRepo: INotificationRepository,
    private readonly clock: IClock,
    private readonly config: AuthConfig,
  ) {}

  /**
   * Returns `{ devOtp }` -- `devOtp` is only ever populated for the
   * dev-mode SMS bypass below (see isDevSmsBypass); every other path
   * returns `{}` and callers that don't care (login/register/forgot-
   * password, all email channel) can ignore the result exactly as before.
   */
  async issue(user: User, purpose: OtpPurpose): Promise<{ devOtp?: string }> {
    const channel = purpose === "phone_verification" ? "sms" : "email";
    const destination = channel === "email" ? user.email : user.phone;

    if (!destination) {
      // Asking to phone-verify a user with no phone on file is a caller bug,
      // not a runtime/user error -- fail loudly rather than silently no-op.
      throw new ValidationError(`Cannot send ${channel} OTP: user has no ${channel} on file`);
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

    // Dev-mode SMS bypass, gated on the dedicated DEV_OTP_MODE env var
    // (AuthConfig.devOtpMode) -- deliberately NOT on isProduction/NODE_ENV.
    // Render sets NODE_ENV=production on this deployed web service
    // regardless of whether a real, DLT-registered Twilio account is
    // configured, so an isProduction-based version of this check never
    // actually took the bypass branch here -- every "Verify Phone" click
    // still called Twilio and hit the same 572006 trial/DLT rejection.
    // Generation, hashing, storage, expiry, and verification above/below
    // are completely unchanged; only the "sms" channel's delivery step is
    // skipped when devOtpMode is true, in favor of handing the plaintext
    // code straight back to the caller and logging it, so the rest of the
    // flow stays fully testable without a real SMS provider. Email OTP
    // delivery (login/email_verification/password_reset) is unaffected
    // regardless of this flag.
    const isDevSmsBypass = channel === "sms" && this.config.devOtpMode;

    if (isDevSmsBypass) {
      // Intentional: explicit dev-mode OTP visibility, not app logging. No
      // `no-console` ESLint rule is enabled in this project's config (see
      // backend/.eslintrc.cjs), so no disable directive is needed here --
      // one was previously present but flagged as unused by CI's
      // --report-unused-disable-directives check.
      console.log(`[DEV OTP] ${purpose} code for user ${user.id} (${destination}): ${code}`);
    } else {
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
      // preserved in `details` keeps the real SMTP/SMS failure reason
      // visible in server-side logs while giving the client an honest,
      // specific status instead of an opaque crash.
      try {
        await this.notificationSender.send({
          channel,
          to: destination,
          subject: copy.title,
          body: `Your code to ${copy.label} is ${code}. It expires in ${Math.round(
            this.config.otpTtlSeconds / 60,
          )} minutes. Do not share it with anyone.`,
        });
      } catch (err) {
        const cause = err instanceof Error ? err.message : String(err);
        throw new ServiceUnavailableError(
          `We couldn't send your verification code right now. Please try again in a moment.`,
          { channel, cause },
        );
      }
    }

    await this.notificationRepo.create({
      userId: user.id,
      type: `otp.${purpose}`,
      title: copy.title,
      body: `We sent a code to your ${channel === "email" ? "email" : "phone"} to ${copy.label}.`,
      data: { purpose, channel },
    });

    return isDevSmsBypass ? { devOtp: code } : {};
  }
}
