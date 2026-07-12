import { JwtTokenService } from "@/infrastructure/security/JwtTokenService";
import { SessionIssuer } from "@/application/auth/shared/SessionIssuer";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";
import { OtpVerifier } from "@/application/auth/shared/OtpVerifier";
import { AuthConfig } from "@/application/dtos/AuthConfig";

import { RegisterUserUseCase } from "@/application/auth/RegisterUser.usecase";
import { LoginUserUseCase } from "@/application/auth/LoginUser.usecase";
import { VerifyOtpUseCase } from "@/application/auth/VerifyOtp.usecase";
import { RefreshTokenUseCase } from "@/application/auth/RefreshToken.usecase";
import { LogoutUserUseCase } from "@/application/auth/LogoutUser.usecase";
import { LogoutAllDevicesUseCase } from "@/application/auth/LogoutAllDevices.usecase";
import { ForgotPasswordUseCase } from "@/application/auth/ForgotPassword.usecase";
import { ResetPasswordUseCase } from "@/application/auth/ResetPassword.usecase";
import { GetMeUseCase } from "@/application/users/GetMe.usecase";
import { UpdateMeUseCase } from "@/application/users/UpdateMe.usecase";
import { DeleteMeUseCase } from "@/application/users/DeleteMe.usecase";
import { ListNotificationsUseCase } from "@/application/notifications/ListNotifications.usecase";
import { MarkNotificationsReadUseCase } from "@/application/notifications/MarkNotificationsRead.usecase";

import { FakeClock } from "./fakes/FakeClock";
import { FakeHasher } from "./fakes/FakeHasher";
import { FakeOtpGenerator } from "./fakes/FakeOtpGenerator";
import { FakeNotificationSender } from "./fakes/FakeNotificationSender";
import { FakeEmailService } from "./fakes/FakeEmailService";
import { InMemoryUserRepository } from "./fakes/InMemoryUserRepository";
import { InMemoryRoleRepository } from "./fakes/InMemoryRoleRepository";
import { InMemoryUserRoleRepository } from "./fakes/InMemoryUserRoleRepository";
import { InMemoryUserDeviceRepository } from "./fakes/InMemoryUserDeviceRepository";
import { InMemorySessionRepository } from "./fakes/InMemorySessionRepository";
import { InMemoryRefreshTokenRepository } from "./fakes/InMemoryRefreshTokenRepository";
import { InMemoryOtpRepository } from "./fakes/InMemoryOtpRepository";
import { InMemoryNotificationRepository } from "./fakes/InMemoryNotificationRepository";
import { InMemoryUserPreferenceRepository } from "./fakes/InMemoryUserPreferenceRepository";
import { InMemoryAuditLogRepository } from "./fakes/InMemoryAuditLogRepository";
import { InMemoryActivityLogRepository } from "./fakes/InMemoryActivityLogRepository";
import { DeviceContext } from "@/application/auth/shared/SessionIssuer";

export const TEST_AUTH_CONFIG: AuthConfig = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 2_592_000,
  otpLength: 6,
  otpTtlSeconds: 300,
  otpMaxAttempts: 3,
};

export const TEST_DEVICE: DeviceContext = {
  deviceId: "test-device-1",
  platform: "web",
  userAgent: "vitest-agent/1.0",
  ipAddress: "127.0.0.1",
};

/**
 * Wires the exact same use-cases the real app uses, but backed entirely by
 * in-memory fakes instead of Postgres/bcrypt/a real mailer. This is the
 * Clean Architecture payoff: the business logic under test here is
 * byte-for-byte the same code the HTTP layer calls in production --
 * only the infrastructure is swapped.
 */
export function buildTestContainer(otpCode = "123456", authConfig: AuthConfig = TEST_AUTH_CONFIG) {
  const clock = new FakeClock();
  const hasher = new FakeHasher();
  const otpGenerator = new FakeOtpGenerator(otpCode);
  const notificationSender = new FakeNotificationSender();
  const emailService = new FakeEmailService();
  const tokenService = new JwtTokenService({
    secret: "test-secret-do-not-use-in-prod",
    issuer: "rentit-test",
    audience: "rentit-test-clients",
    accessTokenTtlSeconds: authConfig.accessTokenTtlSeconds,
  });

  const userRepo = new InMemoryUserRepository();
  const roleRepo = new InMemoryRoleRepository();
  const userRoleRepo = new InMemoryUserRoleRepository(roleRepo);
  userRepo.setUserRoleRepo(userRoleRepo);
  const userDeviceRepo = new InMemoryUserDeviceRepository();
  const sessionRepo = new InMemorySessionRepository();
  const refreshTokenRepo = new InMemoryRefreshTokenRepository();
  const otpRepo = new InMemoryOtpRepository(clock);
  const notificationRepo = new InMemoryNotificationRepository();
  const userPreferenceRepo = new InMemoryUserPreferenceRepository();
  const auditLogRepo = new InMemoryAuditLogRepository();
  const activityLogRepo = new InMemoryActivityLogRepository();

  const sessionIssuer = new SessionIssuer(
    userDeviceRepo,
    sessionRepo,
    refreshTokenRepo,
    tokenService,
    clock,
    authConfig,
  );
  const otpIssuer = new OtpIssuer(
    otpRepo,
    hasher,
    otpGenerator,
    notificationSender,
    notificationRepo,
    clock,
    authConfig,
  );
  const otpVerifier = new OtpVerifier(otpRepo, hasher, clock);

  const useCases = {
    registerUser: new RegisterUserUseCase(
      userRepo,
      roleRepo,
      userRoleRepo,
      userPreferenceRepo,
      auditLogRepo,
      hasher,
      sessionIssuer,
      otpIssuer,
      emailService,
    ),
    loginUser: new LoginUserUseCase(
      userRepo,
      userRoleRepo,
      auditLogRepo,
      hasher,
      clock,
      sessionIssuer,
      otpIssuer,
    ),
    verifyOtp: new VerifyOtpUseCase(
      userRepo,
      userRoleRepo,
      auditLogRepo,
      clock,
      sessionIssuer,
      otpVerifier,
    ),
    refreshToken: new RefreshTokenUseCase(
      refreshTokenRepo,
      sessionRepo,
      userRoleRepo,
      auditLogRepo,
      tokenService,
      clock,
      authConfig,
    ),
    logoutUser: new LogoutUserUseCase(refreshTokenRepo, sessionRepo, auditLogRepo, tokenService),
    logoutAllDevices: new LogoutAllDevicesUseCase(refreshTokenRepo, sessionRepo, auditLogRepo),
    forgotPassword: new ForgotPasswordUseCase(userRepo, auditLogRepo, otpIssuer),
    resetPassword: new ResetPasswordUseCase(
      userRepo,
      refreshTokenRepo,
      sessionRepo,
      auditLogRepo,
      notificationRepo,
      hasher,
      otpVerifier,
    ),
    getMe: new GetMeUseCase(userRepo, userRoleRepo, userPreferenceRepo),
    updateMe: new UpdateMeUseCase(userRepo, userRoleRepo, userPreferenceRepo, activityLogRepo, otpIssuer),
    deleteMe: new DeleteMeUseCase(userRepo, refreshTokenRepo, sessionRepo, auditLogRepo),
    listNotifications: new ListNotificationsUseCase(notificationRepo),
    markNotificationsRead: new MarkNotificationsReadUseCase(notificationRepo, activityLogRepo),
  };

  return {
    ...useCases,
    clock,
    tokenService,
    notificationSender,
    emailService,
    repos: {
      userRepo,
      roleRepo,
      userRoleRepo,
      userDeviceRepo,
      sessionRepo,
      refreshTokenRepo,
      otpRepo,
      notificationRepo,
      userPreferenceRepo,
      auditLogRepo,
      activityLogRepo,
    },
  };
}
