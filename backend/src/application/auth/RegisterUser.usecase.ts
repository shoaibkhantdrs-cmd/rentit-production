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

export interface RegisterUserInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  device: DeviceContext;
}

const DEFAULT_ROLE = "customer";

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

    const role = await this.roleRepo.findByName(DEFAULT_ROLE);
    if (role) {
      await this.userRoleRepo.assign(user.id, role.id, null);
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

    // Fire-and-forget-but-awaited verification codes. Failure to send should
    // not fail registration itself once the account row exists.
    await this.otpIssuer.issue(user, "email_verification");
    if (input.phone) {
      await this.otpIssuer.issue(user, "phone_verification");
    }
    await this.emailService.send(buildWelcomeEmail(user.email, user.name));

    const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
    const tokens = await this.sessionIssuer.issue(user.id, roleNames, input.device);

    return {
      user: toPublicUser(user, roleNames),
      ...tokens,
    };
  }
}
