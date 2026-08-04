import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IRoleRepository } from "@/domain/repositories/IRoleRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IHasher } from "@/domain/services/IHasher";
import { toPublicUser } from "@/domain/entities/User";
import { ConflictError } from "@/domain/errors/AppError";
import { SessionIssuer, DeviceContext } from "@/application/auth/shared/SessionIssuer";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";
import { IEmailService } from "@/domain/services/IEmailService";
import { buildWelcomeEmail } from "@/application/notifications/EmailTemplates";
import { logger } from "@/infrastructure/logging/logger";

export interface RegisterUserInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  device: DeviceContext;
}

// Both roles: "customer" so every renter-facing page works, "property_owner"
// so List/Edit/Delete Property and image upload -- all role-gated in
// property.routes.ts via authorize("property_owner", "admin", "super_admin")
// -- work immediately too, with no admin step required. RentIt's real users
// are both renters and owners interchangeably (the same person browses
// listings AND may want to list their own place), so "customer" was never
// a meaningful restriction to gate listing behind -- it just meant every
// brand-new signup hit a dead-end 403/"contact support" wall on List
// Property until an admin manually granted the role. Mirrors the identical
// DEMO_USER_ROLES pattern already used by DevAutoLoginUseCase for local dev.
const DEFAULT_ROLES = ["customer", "property_owner"];

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly hasher: IHasher,
    private readonly sessionIssuer: SessionIssuer,
    private readonly otpIssuer: OtpIssuer,
    private readonly emailService: IEmailService,
  ) {}

  async execute(input: RegisterUserInput) {
    const email = input.email.trim().toLowerCase();

    const existingByEmail = await this.userRepo.findByEmail(email);
    if (existingByEmail) {
      throw new ConflictError("An account with this email already exists");
    }

    if (input.phone) {
      const existingByPhone = await this.userRepo.findByPhone(input.phone);
      if (existingByPhone) {
        throw new ConflictError("An account with this phone number already exists");
      }
    }

    const passwordHash = input.password ? await this.hasher.hash(input.password) : null;

    const user = await this.userRepo.create({
      name: input.name.trim(),
      email,
      phone: input.phone,
      passwordHash,
    });

    for (const roleName of DEFAULT_ROLES) {
      const role = await this.roleRepo.findByName(roleName);
      if (role) {
        await this.userRoleRepo.assign(user.id, role.id, null);
      }
    }

    await this.userPreferenceRepo.createDefault(user.id);

    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.register",
      entityType: "user",
      entityId: user.id,
      ipAddress: input.device.ipAddress,
      userAgent: input.device.userAgent,
    });

// Verification codes and the welcome email are best-effort: the account
        // row already exists at this point, so a notification-provider failure
        // (e.g. SMTP misconfiguration) must never fail registration itself.
        try {
                await this.otpIssuer.issue(user, "email_verification");
                if (input.phone) {
                          await this.otpIssuer.issue(user, "phone_verification");
                }
        } catch (err) {
                logger.error({ err, userId: user.id }, "Failed to issue verification OTP during registration");
        }

        try {
                await this.emailService.send(buildWelcomeEmail(user.email, user.name));
        } catch (err) {
                logger.error({ err, userId: user.id }, "Failed to send welcome email during registration");
        }

    const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
    const tokens = await this.sessionIssuer.issue(user.id, roleNames, input.device);

    return {
      user: toPublicUser(user, roleNames),
      ...tokens,
    };
  }
}
