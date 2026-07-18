"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_TEST_AUTH_CONFIG = void 0;
exports.buildAdminTestContainer = buildAdminTestContainer;
const OtpIssuer_1 = require("@/application/auth/shared/OtpIssuer");
const DeleteProperty_usecase_1 = require("@/application/properties/DeleteProperty.usecase");
const ReportUser_usecase_1 = require("@/application/users/ReportUser.usecase");
const SearchUsers_usecase_1 = require("@/application/admin/users/SearchUsers.usecase");
const GetUserProfile_usecase_1 = require("@/application/admin/users/GetUserProfile.usecase");
const UpdateUserStatus_usecase_1 = require("@/application/admin/users/UpdateUserStatus.usecase");
const AdminDeleteUser_usecase_1 = require("@/application/admin/users/AdminDeleteUser.usecase");
const AdminResetUserPassword_usecase_1 = require("@/application/admin/users/AdminResetUserPassword.usecase");
const UpdateUserRoles_usecase_1 = require("@/application/admin/users/UpdateUserRoles.usecase");
const GetUserActivity_usecase_1 = require("@/application/admin/users/GetUserActivity.usecase");
const AdminSearchProperties_usecase_1 = require("@/application/admin/properties/AdminSearchProperties.usecase");
const ApproveProperty_usecase_1 = require("@/application/admin/properties/ApproveProperty.usecase");
const RejectProperty_usecase_1 = require("@/application/admin/properties/RejectProperty.usecase");
const HideProperty_usecase_1 = require("@/application/admin/properties/HideProperty.usecase");
const UnhideProperty_usecase_1 = require("@/application/admin/properties/UnhideProperty.usecase");
const FeatureProperty_usecase_1 = require("@/application/admin/properties/FeatureProperty.usecase");
const UnfeatureProperty_usecase_1 = require("@/application/admin/properties/UnfeatureProperty.usecase");
const BulkModerateProperties_usecase_1 = require("@/application/admin/properties/BulkModerateProperties.usecase");
const GetPropertyModerationHistory_usecase_1 = require("@/application/admin/properties/GetPropertyModerationHistory.usecase");
const ListPropertyReports_usecase_1 = require("@/application/admin/reports/ListPropertyReports.usecase");
const UpdatePropertyReportStatus_usecase_1 = require("@/application/admin/reports/UpdatePropertyReportStatus.usecase");
const ListUserReports_usecase_1 = require("@/application/admin/reports/ListUserReports.usecase");
const UpdateUserReportStatus_usecase_1 = require("@/application/admin/reports/UpdateUserReportStatus.usecase");
const SubmitIdentityVerification_usecase_1 = require("@/application/verification/SubmitIdentityVerification.usecase");
const GetMyVerificationStatus_usecase_1 = require("@/application/verification/GetMyVerificationStatus.usecase");
const ListIdentityVerifications_usecase_1 = require("@/application/admin/verification/ListIdentityVerifications.usecase");
const ApproveIdentityVerification_usecase_1 = require("@/application/admin/verification/ApproveIdentityVerification.usecase");
const RejectIdentityVerification_usecase_1 = require("@/application/admin/verification/RejectIdentityVerification.usecase");
const BroadcastNotification_usecase_1 = require("@/application/admin/notifications/BroadcastNotification.usecase");
const GetDashboardStats_usecase_1 = require("@/application/admin/analytics/GetDashboardStats.usecase");
const GetGrowthAnalytics_usecase_1 = require("@/application/admin/analytics/GetGrowthAnalytics.usecase");
const GetTopProperties_usecase_1 = require("@/application/admin/analytics/GetTopProperties.usecase");
const SearchAuditLogs_usecase_1 = require("@/application/admin/audit/SearchAuditLogs.usecase");
const GetSystemHealth_usecase_1 = require("@/application/admin/system/GetSystemHealth.usecase");
const NotifySavedSearchesForProperty_usecase_1 = require("@/application/savedsearches/NotifySavedSearchesForProperty.usecase");
const FakeClock_1 = require("./fakes/FakeClock");
const FakeEmailService_1 = require("./fakes/FakeEmailService");
const FakeHasher_1 = require("./fakes/FakeHasher");
const FakeOtpGenerator_1 = require("./fakes/FakeOtpGenerator");
const FakeNotificationSender_1 = require("./fakes/FakeNotificationSender");
const FakePushNotificationService_1 = require("./fakes/FakePushNotificationService");
const FakeHealthCheckService_1 = require("./fakes/FakeHealthCheckService");
const FakeImageStorageService_1 = require("./fakes/FakeImageStorageService");
const InMemoryUserRepository_1 = require("./fakes/InMemoryUserRepository");
const InMemoryRoleRepository_1 = require("./fakes/InMemoryRoleRepository");
const InMemoryUserRoleRepository_1 = require("./fakes/InMemoryUserRoleRepository");
const InMemoryRefreshTokenRepository_1 = require("./fakes/InMemoryRefreshTokenRepository");
const InMemorySessionRepository_1 = require("./fakes/InMemorySessionRepository");
const InMemoryOtpRepository_1 = require("./fakes/InMemoryOtpRepository");
const InMemoryNotificationRepository_1 = require("./fakes/InMemoryNotificationRepository");
const InMemoryUserPreferenceRepository_1 = require("./fakes/InMemoryUserPreferenceRepository");
const InMemoryAuditLogRepository_1 = require("./fakes/InMemoryAuditLogRepository");
const InMemoryActivityLogRepository_1 = require("./fakes/InMemoryActivityLogRepository");
const InMemoryPropertyRepository_1 = require("./fakes/InMemoryPropertyRepository");
const InMemoryPropertyLocationRepository_1 = require("./fakes/InMemoryPropertyLocationRepository");
const InMemoryPropertyStatusHistoryRepository_1 = require("./fakes/InMemoryPropertyStatusHistoryRepository");
const InMemoryPropertyReportRepository_1 = require("./fakes/InMemoryPropertyReportRepository");
const InMemoryPropertyImageRepository_1 = require("./fakes/InMemoryPropertyImageRepository");
const InMemoryPropertyFeatureRepository_1 = require("./fakes/InMemoryPropertyFeatureRepository");
const InMemoryPropertyFavoriteRepository_1 = require("./fakes/InMemoryPropertyFavoriteRepository");
const InMemoryPropertyViewRepository_1 = require("./fakes/InMemoryPropertyViewRepository");
const InMemoryUserReportRepository_1 = require("./fakes/InMemoryUserReportRepository");
const InMemoryIdentityVerificationRepository_1 = require("./fakes/InMemoryIdentityVerificationRepository");
const InMemoryAdminAnalyticsRepository_1 = require("./fakes/InMemoryAdminAnalyticsRepository");
const InMemorySavedSearchRepository_1 = require("./fakes/InMemorySavedSearchRepository");
exports.ADMIN_TEST_AUTH_CONFIG = {
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
function buildAdminTestContainer() {
    const clock = new FakeClock_1.FakeClock();
    const hasher = new FakeHasher_1.FakeHasher();
    const otpGenerator = new FakeOtpGenerator_1.FakeOtpGenerator("123456");
    const notificationSender = new FakeNotificationSender_1.FakeNotificationSender();
    const pushService = new FakePushNotificationService_1.FakePushNotificationService();
    const healthCheckService = new FakeHealthCheckService_1.FakeHealthCheckService();
    const imageStorage = new FakeImageStorageService_1.FakeImageStorageService();
    const emailService = new FakeEmailService_1.FakeEmailService();
    const userRepo = new InMemoryUserRepository_1.InMemoryUserRepository();
    const roleRepo = new InMemoryRoleRepository_1.InMemoryRoleRepository();
    const userRoleRepo = new InMemoryUserRoleRepository_1.InMemoryUserRoleRepository(roleRepo);
    userRepo.setUserRoleRepo(userRoleRepo);
    const refreshTokenRepo = new InMemoryRefreshTokenRepository_1.InMemoryRefreshTokenRepository();
    const sessionRepo = new InMemorySessionRepository_1.InMemorySessionRepository();
    const otpRepo = new InMemoryOtpRepository_1.InMemoryOtpRepository(clock);
    const notificationRepo = new InMemoryNotificationRepository_1.InMemoryNotificationRepository();
    const userPreferenceRepo = new InMemoryUserPreferenceRepository_1.InMemoryUserPreferenceRepository();
    const auditLogRepo = new InMemoryAuditLogRepository_1.InMemoryAuditLogRepository();
    const activityLogRepo = new InMemoryActivityLogRepository_1.InMemoryActivityLogRepository();
    const locationRepo = new InMemoryPropertyLocationRepository_1.InMemoryPropertyLocationRepository();
    const propertyRepo = new InMemoryPropertyRepository_1.InMemoryPropertyRepository(locationRepo);
    const propertyImageRepo = new InMemoryPropertyImageRepository_1.InMemoryPropertyImageRepository();
    const propertyFeatureRepo = new InMemoryPropertyFeatureRepository_1.InMemoryPropertyFeatureRepository();
    const propertyFavoriteRepo = new InMemoryPropertyFavoriteRepository_1.InMemoryPropertyFavoriteRepository();
    const propertyViewRepo = new InMemoryPropertyViewRepository_1.InMemoryPropertyViewRepository(clock);
    const propertyStatusHistoryRepo = new InMemoryPropertyStatusHistoryRepository_1.InMemoryPropertyStatusHistoryRepository();
    const propertyReportRepo = new InMemoryPropertyReportRepository_1.InMemoryPropertyReportRepository();
    const userReportRepo = new InMemoryUserReportRepository_1.InMemoryUserReportRepository();
    const identityVerificationRepo = new InMemoryIdentityVerificationRepository_1.InMemoryIdentityVerificationRepository();
    const savedSearchRepo = new InMemorySavedSearchRepository_1.InMemorySavedSearchRepository();
    const adminAnalyticsRepo = new InMemoryAdminAnalyticsRepository_1.InMemoryAdminAnalyticsRepository(userRepo, propertyRepo, propertyReportRepo, userReportRepo, identityVerificationRepo, propertyViewRepo, propertyFavoriteRepo);
    const otpIssuer = new OtpIssuer_1.OtpIssuer(otpRepo, hasher, otpGenerator, notificationSender, notificationRepo, clock, exports.ADMIN_TEST_AUTH_CONFIG);
    const deleteProperty = new DeleteProperty_usecase_1.DeletePropertyUseCase(propertyRepo, propertyStatusHistoryRepo);
    const reportUser = new ReportUser_usecase_1.ReportUserUseCase(userRepo, userReportRepo, auditLogRepo);
    // --- admin: users ---
    const searchUsers = new SearchUsers_usecase_1.SearchUsersUseCase(userRepo);
    const getUserProfile = new GetUserProfile_usecase_1.GetUserProfileUseCase(userRepo, userRoleRepo, userPreferenceRepo, activityLogRepo, propertyRepo);
    const updateUserStatus = new UpdateUserStatus_usecase_1.UpdateUserStatusUseCase(userRepo, userRoleRepo, refreshTokenRepo, sessionRepo, auditLogRepo);
    const adminDeleteUser = new AdminDeleteUser_usecase_1.AdminDeleteUserUseCase(userRepo, userRoleRepo, refreshTokenRepo, sessionRepo, auditLogRepo);
    const adminResetUserPassword = new AdminResetUserPassword_usecase_1.AdminResetUserPasswordUseCase(userRepo, userRoleRepo, auditLogRepo, otpIssuer);
    const updateUserRoles = new UpdateUserRoles_usecase_1.UpdateUserRolesUseCase(userRepo, userRoleRepo, roleRepo, auditLogRepo);
    const getUserActivity = new GetUserActivity_usecase_1.GetUserActivityUseCase(userRepo, activityLogRepo);
    // --- admin: properties ---
    const adminSearchProperties = new AdminSearchProperties_usecase_1.AdminSearchPropertiesUseCase(propertyRepo);
    const notifySavedSearchesForProperty = new NotifySavedSearchesForProperty_usecase_1.NotifySavedSearchesForPropertyUseCase(savedSearchRepo, locationRepo, notificationRepo, userPreferenceRepo, pushService, clock);
    const approveProperty = new ApproveProperty_usecase_1.ApprovePropertyUseCase(propertyRepo, propertyStatusHistoryRepo, notificationRepo, auditLogRepo, clock, userRepo, emailService, notifySavedSearchesForProperty);
    const rejectProperty = new RejectProperty_usecase_1.RejectPropertyUseCase(propertyRepo, propertyStatusHistoryRepo, notificationRepo, auditLogRepo, clock);
    const hideProperty = new HideProperty_usecase_1.HidePropertyUseCase(propertyRepo, propertyStatusHistoryRepo, notificationRepo, auditLogRepo, clock);
    const unhideProperty = new UnhideProperty_usecase_1.UnhidePropertyUseCase(propertyRepo, propertyStatusHistoryRepo, notificationRepo, auditLogRepo, clock);
    const featureProperty = new FeatureProperty_usecase_1.FeaturePropertyUseCase(propertyRepo, auditLogRepo);
    const unfeatureProperty = new UnfeatureProperty_usecase_1.UnfeaturePropertyUseCase(propertyRepo, auditLogRepo);
    const bulkModerateProperties = new BulkModerateProperties_usecase_1.BulkModeratePropertiesUseCase(approveProperty, rejectProperty, hideProperty, unhideProperty, featureProperty, unfeatureProperty, deleteProperty);
    const getPropertyModerationHistory = new GetPropertyModerationHistory_usecase_1.GetPropertyModerationHistoryUseCase(propertyStatusHistoryRepo);
    // --- admin: reports ---
    const listPropertyReports = new ListPropertyReports_usecase_1.ListPropertyReportsUseCase(propertyReportRepo);
    const updatePropertyReportStatus = new UpdatePropertyReportStatus_usecase_1.UpdatePropertyReportStatusUseCase(propertyReportRepo, auditLogRepo);
    const listUserReports = new ListUserReports_usecase_1.ListUserReportsUseCase(userReportRepo);
    const updateUserReportStatus = new UpdateUserReportStatus_usecase_1.UpdateUserReportStatusUseCase(userReportRepo, auditLogRepo);
    // --- verification ---
    const submitIdentityVerification = new SubmitIdentityVerification_usecase_1.SubmitIdentityVerificationUseCase(identityVerificationRepo, imageStorage);
    const getMyVerificationStatus = new GetMyVerificationStatus_usecase_1.GetMyVerificationStatusUseCase(userRepo, identityVerificationRepo);
    const listIdentityVerifications = new ListIdentityVerifications_usecase_1.ListIdentityVerificationsUseCase(identityVerificationRepo);
    const approveIdentityVerification = new ApproveIdentityVerification_usecase_1.ApproveIdentityVerificationUseCase(identityVerificationRepo, userRepo, notificationRepo, auditLogRepo, clock);
    const rejectIdentityVerification = new RejectIdentityVerification_usecase_1.RejectIdentityVerificationUseCase(identityVerificationRepo, notificationRepo, auditLogRepo);
    // --- notifications ---
    const broadcastNotification = new BroadcastNotification_usecase_1.BroadcastNotificationUseCase(userRepo, notificationRepo, pushService, auditLogRepo);
    // --- analytics ---
    const getDashboardStats = new GetDashboardStats_usecase_1.GetDashboardStatsUseCase(adminAnalyticsRepo);
    const getGrowthAnalytics = new GetGrowthAnalytics_usecase_1.GetGrowthAnalyticsUseCase(adminAnalyticsRepo);
    const getTopProperties = new GetTopProperties_usecase_1.GetTopPropertiesUseCase(adminAnalyticsRepo);
    // --- audit ---
    const searchAuditLogs = new SearchAuditLogs_usecase_1.SearchAuditLogsUseCase(auditLogRepo);
    // --- system ---
    const getSystemHealth = new GetSystemHealth_usecase_1.GetSystemHealthUseCase(healthCheckService);
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
