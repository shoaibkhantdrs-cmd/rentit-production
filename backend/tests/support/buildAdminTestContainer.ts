import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";
import { AuthConfig } from "@/application/dtos/AuthConfig";

import { DeletePropertyUseCase } from "@/application/properties/DeleteProperty.usecase";
import { ReportUserUseCase } from "@/application/users/ReportUser.usecase";

import { SearchUsersUseCase } from "@/application/admin/users/SearchUsers.usecase";
import { GetUserProfileUseCase } from "@/application/admin/users/GetUserProfile.usecase";
import { UpdateUserStatusUseCase } from "@/application/admin/users/UpdateUserStatus.usecase";
import { AdminDeleteUserUseCase } from "@/application/admin/users/AdminDeleteUser.usecase";
import { AdminResetUserPasswordUseCase } from "@/application/admin/users/AdminResetUserPassword.usecase";
import { UpdateUserRolesUseCase } from "@/application/admin/users/UpdateUserRoles.usecase";
import { GetUserActivityUseCase } from "@/application/admin/users/GetUserActivity.usecase";

import { AdminSearchPropertiesUseCase } from "@/application/admin/properties/AdminSearchProperties.usecase";
import { ApprovePropertyUseCase } from "@/application/admin/properties/ApproveProperty.usecase";
import { RejectPropertyUseCase } from "@/application/admin/properties/RejectProperty.usecase";
import { HidePropertyUseCase } from "@/application/admin/properties/HideProperty.usecase";
import { UnhidePropertyUseCase } from "@/application/admin/properties/UnhideProperty.usecase";
import { FeaturePropertyUseCase } from "@/application/admin/properties/FeatureProperty.usecase";
import { UnfeaturePropertyUseCase } from "@/application/admin/properties/UnfeatureProperty.usecase";
import { BulkModeratePropertiesUseCase } from "@/application/admin/properties/BulkModerateProperties.usecase";
import { GetPropertyModerationHistoryUseCase } from "@/application/admin/properties/GetPropertyModerationHistory.usecase";

import { ListPropertyReportsUseCase } from "@/application/admin/reports/ListPropertyReports.usecase";
import { UpdatePropertyReportStatusUseCase } from "@/application/admin/reports/UpdatePropertyReportStatus.usecase";
import { ListUserReportsUseCase } from "@/application/admin/reports/ListUserReports.usecase";
import { UpdateUserReportStatusUseCase } from "@/application/admin/reports/UpdateUserReportStatus.usecase";

import { SubmitIdentityVerificationUseCase } from "@/application/verification/SubmitIdentityVerification.usecase";
import { GetMyVerificationStatusUseCase } from "@/application/verification/GetMyVerificationStatus.usecase";
import { ListIdentityVerificationsUseCase } from "@/application/admin/verification/ListIdentityVerifications.usecase";
import { ApproveIdentityVerificationUseCase } from "@/application/admin/verification/ApproveIdentityVerification.usecase";
import { RejectIdentityVerificationUseCase } from "@/application/admin/verification/RejectIdentityVerification.usecase";

import { BroadcastNotificationUseCase } from "@/application/admin/notifications/BroadcastNotification.usecase";

import { GetDashboardStatsUseCase } from "@/application/admin/analytics/GetDashboardStats.usecase";
import { GetGrowthAnalyticsUseCase } from "@/application/admin/analytics/GetGrowthAnalytics.usecase";
import { GetTopPropertiesUseCase } from "@/application/admin/analytics/GetTopProperties.usecase";

import { SearchAuditLogsUseCase } from "@/application/admin/audit/SearchAuditLogs.usecase";
import { GetSystemHealthUseCase } from "@/application/admin/system/GetSystemHealth.usecase";
import { NotifySavedSearchesForPropertyUseCase } from "@/application/savedsearches/NotifySavedSearchesForProperty.usecase";

import { FakeClock } from "./fakes/FakeClock";
import { FakeEmailService } from "./fakes/FakeEmailService";
import { FakeHasher } from "./fakes/FakeHasher";
import { FakeOtpGenerator } from "./fakes/FakeOtpGenerator";
import { FakeNotificationSender } from "./fakes/FakeNotificationSender";
import { FakePushNotificationService } from "./fakes/FakePushNotificationService";
import { FakeHealthCheckService } from "./fakes/FakeHealthCheckService";
import { FakeImageStorageService } from "./fakes/FakeImageStorageService";

import { InMemoryUserRepository } from "./fakes/InMemoryUserRepository";
import { InMemoryRoleRepository } from "./fakes/InMemoryRoleRepository";
import { InMemoryUserRoleRepository } from "./fakes/InMemoryUserRoleRepository";
import { InMemoryRefreshTokenRepository } from "./fakes/InMemoryRefreshTokenRepository";
import { InMemorySessionRepository } from "./fakes/InMemorySessionRepository";
import { InMemoryOtpRepository } from "./fakes/InMemoryOtpRepository";
import { InMemoryNotificationRepository } from "./fakes/InMemoryNotificationRepository";
import { InMemoryUserPreferenceRepository } from "./fakes/InMemoryUserPreferenceRepository";
import { InMemoryAuditLogRepository } from "./fakes/InMemoryAuditLogRepository";
import { InMemoryActivityLogRepository } from "./fakes/InMemoryActivityLogRepository";

import { InMemoryPropertyRepository } from "./fakes/InMemoryPropertyRepository";
import { InMemoryPropertyLocationRepository } from "./fakes/InMemoryPropertyLocationRepository";
import { InMemoryPropertyStatusHistoryRepository } from "./fakes/InMemoryPropertyStatusHistoryRepository";
import { InMemoryPropertyReportRepository } from "./fakes/InMemoryPropertyReportRepository";
import { InMemoryPropertyImageRepository } from "./fakes/InMemoryPropertyImageRepository";
import { InMemoryPropertyFeatureRepository } from "./fakes/InMemoryPropertyFeatureRepository";
import { InMemoryPropertyFavoriteRepository } from "./fakes/InMemoryPropertyFavoriteRepository";
import { InMemoryPropertyViewRepository } from "./fakes/InMemoryPropertyViewRepository";

import { InMemoryUserReportRepository } from "./fakes/InMemoryUserReportRepository";
import { InMemoryIdentityVerificationRepository } from "./fakes/InMemoryIdentityVerificationRepository";
import { InMemoryAdminAnalyticsRepository } from "./fakes/InMemoryAdminAnalyticsRepository";
import { InMemorySavedSearchRepository } from "./fakes/InMemorySavedSearchRepository";

export const ADMIN_TEST_AUTH_CONFIG: AuthConfig = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 2_592_000,
  otpLength: 6,
  otpTtlSeconds: 300,
  otpMaxAttempts: 3,
};

/**
 * Wires every Phase 4 admin use-case against in-memory fakes, plus enough
 * of the Phase 2/3 fakes (users, roles, properties) for the admin
 * use-cases to operate against realistic seed data. Mirrors
 * buildTestContainer.ts / buildPropertyTestContainer.ts's approach.
 */
export function buildAdminTestContainer() {
  const clock = new FakeClock();
  const hasher = new FakeHasher();
  const otpGenerator = new FakeOtpGenerator("123456");
  const notificationSender = new FakeNotificationSender();
  const pushService = new FakePushNotificationService();
  const healthCheckService = new FakeHealthCheckService();
  const imageStorage = new FakeImageStorageService();
  const emailService = new FakeEmailService();

  const userRepo = new InMemoryUserRepository();
  const roleRepo = new InMemoryRoleRepository();
  const userRoleRepo = new InMemoryUserRoleRepository(roleRepo);
  userRepo.setUserRoleRepo(userRoleRepo);
  const refreshTokenRepo = new InMemoryRefreshTokenRepository();
  const sessionRepo = new InMemorySessionRepository();
  const otpRepo = new InMemoryOtpRepository(clock);
  const notificationRepo = new InMemoryNotificationRepository();
  const userPreferenceRepo = new InMemoryUserPreferenceRepository();
  const auditLogRepo = new InMemoryAuditLogRepository();
  const activityLogRepo = new InMemoryActivityLogRepository();

  const locationRepo = new InMemoryPropertyLocationRepository();
  const propertyRepo = new InMemoryPropertyRepository(locationRepo);
  const propertyImageRepo = new InMemoryPropertyImageRepository();
  const propertyFeatureRepo = new InMemoryPropertyFeatureRepository();
  const propertyFavoriteRepo = new InMemoryPropertyFavoriteRepository();
  const propertyViewRepo = new InMemoryPropertyViewRepository(clock);
  const propertyStatusHistoryRepo = new InMemoryPropertyStatusHistoryRepository();
  const propertyReportRepo = new InMemoryPropertyReportRepository();

  const userReportRepo = new InMemoryUserReportRepository();
  const identityVerificationRepo = new InMemoryIdentityVerificationRepository();
  const savedSearchRepo = new InMemorySavedSearchRepository();
  const adminAnalyticsRepo = new InMemoryAdminAnalyticsRepository(
    userRepo,
    propertyRepo,
    propertyReportRepo,
    userReportRepo,
    identityVerificationRepo,
    propertyViewRepo,
    propertyFavoriteRepo,
  );

  const otpIssuer = new OtpIssuer(
    otpRepo,
    hasher,
    otpGenerator,
    notificationSender,
    notificationRepo,
    clock,
    ADMIN_TEST_AUTH_CONFIG,
  );

  const deleteProperty = new DeletePropertyUseCase(propertyRepo, propertyStatusHistoryRepo);
  const reportUser = new ReportUserUseCase(userRepo, userReportRepo, auditLogRepo);

  // --- admin: users ---
  const searchUsers = new SearchUsersUseCase(userRepo);
  const getUserProfile = new GetUserProfileUseCase(
    userRepo,
    userRoleRepo,
    userPreferenceRepo,
    activityLogRepo,
    propertyRepo,
  );
  const updateUserStatus = new UpdateUserStatusUseCase(
    userRepo,
    userRoleRepo,
    refreshTokenRepo,
    sessionRepo,
    auditLogRepo,
  );
  const adminDeleteUser = new AdminDeleteUserUseCase(
    userRepo,
    userRoleRepo,
    refreshTokenRepo,
    sessionRepo,
    auditLogRepo,
  );
  const adminResetUserPassword = new AdminResetUserPasswordUseCase(
    userRepo,
    userRoleRepo,
    auditLogRepo,
    otpIssuer,
  );
  const updateUserRoles = new UpdateUserRolesUseCase(userRepo, userRoleRepo, roleRepo, auditLogRepo);
  const getUserActivity = new GetUserActivityUseCase(userRepo, activityLogRepo);

  // --- admin: properties ---
  const adminSearchProperties = new AdminSearchPropertiesUseCase(propertyRepo);
  const notifySavedSearchesForProperty = new NotifySavedSearchesForPropertyUseCase(
    savedSearchRepo,
    locationRepo,
    notificationRepo,
    userPreferenceRepo,
    pushService,
    clock,
  );
  const approveProperty = new ApprovePropertyUseCase(
    propertyRepo,
    propertyStatusHistoryRepo,
    notificationRepo,
    auditLogRepo,
    clock,
    userRepo,
    emailService,
    notifySavedSearchesForProperty,
  );
  const rejectProperty = new RejectPropertyUseCase(
    propertyRepo,
    propertyStatusHistoryRepo,
    notificationRepo,
    auditLogRepo,
    clock,
  );
  const hideProperty = new HidePropertyUseCase(
    propertyRepo,
    propertyStatusHistoryRepo,
    notificationRepo,
    auditLogRepo,
    clock,
  );
  const unhideProperty = new UnhidePropertyUseCase(
    propertyRepo,
    propertyStatusHistoryRepo,
    notificationRepo,
    auditLogRepo,
    clock,
  );
  const featureProperty = new FeaturePropertyUseCase(propertyRepo, auditLogRepo);
  const unfeatureProperty = new UnfeaturePropertyUseCase(propertyRepo, auditLogRepo);
  const bulkModerateProperties = new BulkModeratePropertiesUseCase(
    approveProperty,
    rejectProperty,
    hideProperty,
    unhideProperty,
    featureProperty,
    unfeatureProperty,
    deleteProperty,
  );
  const getPropertyModerationHistory = new GetPropertyModerationHistoryUseCase(propertyStatusHistoryRepo);

  // --- admin: reports ---
  const listPropertyReports = new ListPropertyReportsUseCase(propertyReportRepo);
  const updatePropertyReportStatus = new UpdatePropertyReportStatusUseCase(propertyReportRepo, auditLogRepo);
  const listUserReports = new ListUserReportsUseCase(userReportRepo);
  const updateUserReportStatus = new UpdateUserReportStatusUseCase(userReportRepo, auditLogRepo);

  // --- verification ---
  const submitIdentityVerification = new SubmitIdentityVerificationUseCase(identityVerificationRepo, imageStorage);
  const getMyVerificationStatus = new GetMyVerificationStatusUseCase(userRepo, identityVerificationRepo);
  const listIdentityVerifications = new ListIdentityVerificationsUseCase(identityVerificationRepo);
  const approveIdentityVerification = new ApproveIdentityVerificationUseCase(
    identityVerificationRepo,
    userRepo,
    notificationRepo,
    auditLogRepo,
    clock,
  );
  const rejectIdentityVerification = new RejectIdentityVerificationUseCase(
    identityVerificationRepo,
    notificationRepo,
    auditLogRepo,
  );

  // --- notifications ---
  const broadcastNotification = new BroadcastNotificationUseCase(
    userRepo,
    notificationRepo,
    pushService,
    auditLogRepo,
  );

  // --- analytics ---
  const getDashboardStats = new GetDashboardStatsUseCase(adminAnalyticsRepo);
  const getGrowthAnalytics = new GetGrowthAnalyticsUseCase(adminAnalyticsRepo);
  const getTopProperties = new GetTopPropertiesUseCase(adminAnalyticsRepo);

  // --- audit ---
  const searchAuditLogs = new SearchAuditLogsUseCase(auditLogRepo);

  // --- system ---
  const getSystemHealth = new GetSystemHealthUseCase(healthCheckService);

  return {
    clock,
    pushService,
    healthCheckService,
    imageStorage,
    emailService,
    notifySavedSearchesForProperty,
    reportUser,
    searchUsers,
    getUserProfile,
    updateUserStatus,
    adminDeleteUser,
    adminResetUserPassword,
    updateUserRoles,
    getUserActivity,
    adminSearchProperties,
    approveProperty,
    rejectProperty,
    hideProperty,
    unhideProperty,
    featureProperty,
    unfeatureProperty,
    bulkModerateProperties,
    getPropertyModerationHistory,
    listPropertyReports,
    updatePropertyReportStatus,
    listUserReports,
    updateUserReportStatus,
    submitIdentityVerification,
    getMyVerificationStatus,
    listIdentityVerifications,
    approveIdentityVerification,
    rejectIdentityVerification,
    broadcastNotification,
    getDashboardStats,
    getGrowthAnalytics,
    getTopProperties,
    searchAuditLogs,
    getSystemHealth,
    repos: {
      userRepo,
      roleRepo,
      userRoleRepo,
      refreshTokenRepo,
      sessionRepo,
      otpRepo,
      notificationRepo,
      userPreferenceRepo,
      auditLogRepo,
      activityLogRepo,
      propertyRepo,
      locationRepo,
      propertyImageRepo,
      propertyFeatureRepo,
      propertyFavoriteRepo,
      propertyViewRepo,
      propertyStatusHistoryRepo,
      propertyReportRepo,
      userReportRepo,
      identityVerificationRepo,
      adminAnalyticsRepo,
      savedSearchRepo,
    },
  };
}
