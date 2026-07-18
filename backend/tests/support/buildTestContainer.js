"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_DEVICE = exports.TEST_AUTH_CONFIG = void 0;
exports.buildTestContainer = buildTestContainer;
const JwtTokenService_1 = require("@/infrastructure/security/JwtTokenService");
const SessionIssuer_1 = require("@/application/auth/shared/SessionIssuer");
const OtpIssuer_1 = require("@/application/auth/shared/OtpIssuer");
const OtpVerifier_1 = require("@/application/auth/shared/OtpVerifier");
const RegisterUser_usecase_1 = require("@/application/auth/RegisterUser.usecase");
const LoginUser_usecase_1 = require("@/application/auth/LoginUser.usecase");
const VerifyOtp_usecase_1 = require("@/application/auth/VerifyOtp.usecase");
const RefreshToken_usecase_1 = require("@/application/auth/RefreshToken.usecase");
const LogoutUser_usecase_1 = require("@/application/auth/LogoutUser.usecase");
const LogoutAllDevices_usecase_1 = require("@/application/auth/LogoutAllDevices.usecase");
const ForgotPassword_usecase_1 = require("@/application/auth/ForgotPassword.usecase");
const ResetPassword_usecase_1 = require("@/application/auth/ResetPassword.usecase");
const GetMe_usecase_1 = require("@/application/users/GetMe.usecase");
const UpdateMe_usecase_1 = require("@/application/users/UpdateMe.usecase");
const DeleteMe_usecase_1 = require("@/application/users/DeleteMe.usecase");
const ListNotifications_usecase_1 = require("@/application/notifications/ListNotifications.usecase");
const MarkNotificationsRead_usecase_1 = require("@/application/notifications/MarkNotificationsRead.usecase");
const FakeClock_1 = require("./fakes/FakeClock");
const FakeHasher_1 = require("./fakes/FakeHasher");
const FakeOtpGenerator_1 = require("./fakes/FakeOtpGenerator");
const FakeNotificationSender_1 = require("./fakes/FakeNotificationSender");
const FakeEmailService_1 = require("./fakes/FakeEmailService");
const InMemoryUserRepository_1 = require("./fakes/InMemoryUserRepository");
const InMemoryRoleRepository_1 = require("./fakes/InMemoryRoleRepository");
const InMemoryUserRoleRepository_1 = require("./fakes/InMemoryUserRoleRepository");
const InMemoryUserDeviceRepository_1 = require("./fakes/InMemoryUserDeviceRepository");
const InMemorySessionRepository_1 = require("./fakes/InMemorySessionRepository");
const InMemoryRefreshTokenRepository_1 = require("./fakes/InMemoryRefreshTokenRepository");
const InMemoryOtpRepository_1 = require("./fakes/InMemoryOtpRepository");
const InMemoryNotificationRepository_1 = require("./fakes/InMemoryNotificationRepository");
const InMemoryUserPreferenceRepository_1 = require("./fakes/InMemoryUserPreferenceRepository");
const InMemoryAuditLogRepository_1 = require("./fakes/InMemoryAuditLogRepository");
const InMemoryActivityLogRepository_1 = require("./fakes/InMemoryActivityLogRepository");
exports.TEST_AUTH_CONFIG = {
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    otpLength: 6,
    otpTtlSeconds: 300,
    otpMaxAttempts: 3,
};
exports.TEST_DEVICE = {
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
function buildTestContainer(otpCode = "123456", authConfig = exports.TEST_AUTH_CONFIG) {
    const clock = new FakeClock_1.FakeClock();
    const hasher = new FakeHasher_1.FakeHasher();
    const otpGenerator = new FakeOtpGenerator_1.FakeOtpGenerator(otpCode);
    const notificationSender = new FakeNotificationSender_1.FakeNotificationSender();
    const emailService = new FakeEmailService_1.FakeEmailService();
    const tokenService = new JwtTokenService_1.JwtTokenService({
        secret: "test-secret-do-not-use-in-prod",
        issuer: "rentit-test",
        audience: "rentit-test-clients",
        accessTokenTtlSeconds: authConfig.accessTokenTtlSeconds,
    });
    const userRepo = new InMemoryUserRepository_1.InMemoryUserRepository();
    const roleRepo = new InMemoryRoleRepository_1.InMemoryRoleRepository();
    const userRoleRepo = new InMemoryUserRoleRepository_1.InMemoryUserRoleRepository(roleRepo);
    userRepo.setUserRoleRepo(userRoleRepo);
    const userDeviceRepo = new InMemoryUserDeviceRepository_1.InMemoryUserDeviceRepository();
    const sessionRepo = new InMemorySessionRepository_1.InMemorySessionRepository();
    const refreshTokenRepo = new InMemoryRefreshTokenRepository_1.InMemoryRefreshTokenRepository();
    const otpRepo = new InMemoryOtpRepository_1.InMemoryOtpRepository(clock);
    const notificationRepo = new InMemoryNotificationRepository_1.InMemoryNotificationRepository();
    const userPreferenceRepo = new InMemoryUserPreferenceRepository_1.InMemoryUserPreferenceRepository();
    const auditLogRepo = new InMemoryAuditLogRepository_1.InMemoryAuditLogRepository();
    const activityLogRepo = new InMemoryActivityLogRepository_1.InMemoryActivityLogRepository();
    const sessionIssuer = new SessionIssuer_1.SessionIssuer(userDeviceRepo, sessionRepo, refreshTokenRepo, tokenService, clock, authConfig);
    const otpIssuer = new OtpIssuer_1.OtpIssuer(otpRepo, hasher, otpGenerator, notificationSender, notificationRepo, clock, authConfig);
    const otpVerifier = new OtpVerifier_1.OtpVerifier(otpRepo, hasher, clock);
    const useCases = {
        registerUser: new RegisterUser_usecase_1.RegisterUserUseCase(userRepo, roleRepo, userRoleRepo, userPreferenceRepo, auditLogRepo, hasher, sessionIssuer, otpIssuer, emailService),
        loginUser: new LoginUser_usecase_1.LoginUserUseCase(userRepo, userRoleRepo, auditLogRepo, hasher, clock, sessionIssuer, otpIssuer),
        verifyOtp: new VerifyOtp_usecase_1.VerifyOtpUseCase(userRepo, userRoleRepo, auditLogRepo, clock, sessionIssuer, otpVerifier),
        refreshToken: new RefreshToken_usecase_1.RefreshTokenUseCase(refreshTokenRepo, sessionRepo, userRoleRepo, auditLogRepo, tokenService, clock, authConfig),
        logoutUser: new LogoutUser_usecase_1.LogoutUserUseCase(refreshTokenRepo, sessionRepo, auditLogRepo, tokenService),
        logoutAllDevices: new LogoutAllDevices_usecase_1.LogoutAllDevicesUseCase(refreshTokenRepo, sessionRepo, auditLogRepo),
        forgotPassword: new ForgotPassword_usecase_1.ForgotPasswordUseCase(userRepo, auditLogRepo, otpIssuer),
        resetPassword: new ResetPassword_usecase_1.ResetPasswordUseCase(userRepo, refreshTokenRepo, sessionRepo, auditLogRepo, notificationRepo, hasher, otpVerifier),
        getMe: new GetMe_usecase_1.GetMeUseCase(userRepo, userRoleRepo, userPreferenceRepo),
        updateMe: new UpdateMe_usecase_1.UpdateMeUseCase(userRepo, userRoleRepo, userPreferenceRepo, activityLogRepo, otpIssuer),
        deleteMe: new DeleteMe_usecase_1.DeleteMeUseCase(userRepo, refreshTokenRepo, sessionRepo, auditLogRepo),
        listNotifications: new ListNotifications_usecase_1.ListNotificationsUseCase(notificationRepo),
        markNotificationsRead: new MarkNotificationsRead_usecase_1.MarkNotificationsReadUseCase(notificationRepo, activityLogRepo),
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
