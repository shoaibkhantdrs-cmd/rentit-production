import { IOtpRepository } from "@/domain/repositories/IOtpRepository";
import { IHasher } from "@/domain/services/IHasher";
import { IOtpGenerator } from "@/domain/services/IOtpGenerator";
import { INotificationSender } from "@/domain/services/INotificationSender";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IClock } from "@/domain/services/IClock";
import { AuthConfig } from "@/application/dtos/AuthConfig";
import { OtpPurpose } from "@/domain/entities/OtpCode";
import { User } from "@/domain/entities/User";
import { ValidationError } from "@/domain/errors/AppError";

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

  async issue(user: User, purpose: OtpPurpose): Promise<void> {
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

    await this.notificationSender.send({
      channel,
      to: destination,
      subject: copy.title,
      body: `Your code to ${copy.label} is ${code}. It expires in ${Math.round(
        this.config.otpTtlSeconds / 60,
      )} minutes. Do not share it with anyone.`,
    });

    await this.notificationRepo.create({
      userId: user.id,
      type: `otp.${purpose}`,
      title: copy.title,
      body: `We sent a code to your ${channel === "email" ? "email" : "phone"} to ${copy.label}.`,
      data: { purpose, channel },
    });
  }
}
