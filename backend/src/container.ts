/**
 * Composition root: the one place in the app that is allowed to know
 * about every concrete class. Everything above this file (use-cases,
 * controllers) only ever sees interfaces; everything below it
 * (repositories, services) only ever implements interfaces. Swapping an
 * implementation -- a different DB driver, a real email provider, a
 * different token strategy -- means changing exactly one line here.
 */
import { pool } from "@/config/database";
import { env } from "@/config/env";

// Infrastructure
import { UserRepository } from "@/infrastructure/database/repositories/UserRepository";
import { RoleRepository } from "@/infrastructure/database/repositories/RoleRepository";
import { UserRoleRepository } from "@/infrastructure/database/repositories/UserRoleRepository";
import { UserDeviceRepository } from "@/infrastructure/database/repositories/UserDeviceRepository";
import { SessionRepository } from "@/infrastructure/database/repositories/SessionRepository";
import { RefreshTokenRepository } from "@/infrastructure/database/repositories/RefreshTokenRepository";
import { OtpRepository } from "@/infrastructure/database/repositories/OtpRepository";
import { NotificationRepository } from "@/infrastructure/database/repositories/NotificationRepository";
import { UserPreferenceRepository } from "@/infrastructure/database/repositories/UserPreferenceRepository";
import { AuditLogRepository } from "@/infrastructure/database/repositories/AuditLogRepository";
import { ActivityLogRepository } from "@/infrastructure/database/repositories/ActivityLogRepository";
import { BcryptHasher } from "@/infrastructure/security/BcryptHasher";
import { JwtTokenService } from "@/infrastructure/security/JwtTokenService";
import { CryptoOtpGenerator } from "@/infrastructure/security/CryptoOtpGenerator";
import { SystemClock } from "@/infrastructure/time/SystemClock";
import { PropertyRepository } from "@/infrastructure/database/repositories/PropertyRepository";
import { PropertyCategoryRepository } from "@/infrastructure/database/repositories/PropertyCategoryRepository";
import { PropertyLocationRepository } from "@/infrastructure/database/repositories/PropertyLocationRepository";
import { PropertyImageRepository } from "@/infrastructure/database/repositories/PropertyImageRepository";
import { PropertyFeatureRepository } from "@/infrastructure/database/repositories/PropertyFeatureRepository";
import { PropertyViewRepository } from "@/infrastructure/database/repositories/PropertyViewRepository";
import { PropertyFavoriteRepository } from "@/infrastructure/database/repositories/PropertyFavoriteRepository";
import { PropertyReportRepository } from "@/infrastructure/database/repositories/PropertyReportRepository";
import { PropertyStatusHistoryRepository } from "@/infrastructure/database/repositories/PropertyStatusHistoryRepository";
import { UserReportRepository } from "@/infrastructure/database/repositories/UserReportRepository";
import { IdentityVerificationRepository } from "@/infrastructure/database/repositories/IdentityVerificationRepository";
import { AdminAnalyticsRepository } from "@/infrastructure/database/repositories/AdminAnalyticsRepository";
import { CloudinaryImageStorageService } from "@/infrastructure/storage/CloudinaryImageStorageService";
import { GoogleGeocodingService } from "@/infrastructure/maps/GoogleGeocodingService";
import { ConsolePushNotificationService } from "@/infrastructure/notifications/ConsolePushNotificationService";
import { FcmPushNotificationService } from "@/infrastructure/notifications/FcmPushNotificationService";
import { PostgresHealthCheckService } from "@/infrastructure/database/PostgresHealthCheckService";
import { ConversationRepository } from "@/infrastructure/database/repositories/ConversationRepository";
import { MessageRepository } from "@/infrastructure/database/repositories/MessageRepository";
import { SavedSearchRepository } from "@/infrastructure/database/repositories/SavedSearchRepository";
import { WebSocketGateway } from "@/infrastructure/realtime/WebSocketGateway";
import { ConsoleEmailService } from "@/infrastructure/email/ConsoleEmailService";
import { SmtpEmailService } from "@/infrastructure/email/SmtpEmailService";
import { ConsoleSmsService } from "@/infrastructure/sms/ConsoleSmsService";
import { TwilioSmsService } from "@/infrastructure/sms/TwilioSmsService";
import { ChannelNotificationSender } from "@/infrastructure/notifications/ChannelNotificationSender";
import { ConsoleWhatsAppService } from "@/infrastructure/whatsapp/ConsoleWhatsAppService";
import { WhatsAppCloudApiService } from "@/infrastructure/whatsapp/WhatsAppCloudApiService";

// Application (shared)
import { SessionIssuer } from "@/application/auth/shared/SessionIssuer";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";
import { OtpVerifier } from "@/application/auth/shared/OtpVerifier";
import { AuthConfig } from "@/application/dtos/AuthConfig";

// Application (use-cases)
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
import { PropertyDetailLoader } from "@/application/properties/shared/PropertyDetailLoader";
import { CreatePropertyUseCase } from "@/application/properties/CreateProperty.usecase";
import { GetPropertyUseCase } from "@/application/properties/GetProperty.usecase";
import { SearchPropertiesUseCase } from "@/application/properties/SearchProperties.usecase";
import { UpdatePropertyUseCase } from "@/application/properties/UpdateProperty.usecase";
import { DeletePropertyUseCase } from "@/application/properties/DeleteProperty.usecase";
import { UploadPropertyImagesUseCase } from "@/application/properties/UploadPropertyImages.usecase";
import { DeletePropertyImageUseCase } from "@/application/properties/DeletePropertyImage.usecase";
import { FavoritePropertyUseCase } from "@/application/properties/FavoriteProperty.usecase";
import { UnfavoritePropertyUseCase } from "@/application/properties/UnfavoriteProperty.usecase";
import { ReportPropertyUseCase } from "@/application/properties/ReportProperty.usecase";
import { GetMyPropertiesUseCase } from "@/application/properties/GetMyProperties.usecase";
import { GetMyFavoritesUseCase } from "@/application/properties/GetMyFavorites.usecase";
import { ListPropertyCategoriesUseCase } from "@/application/properties/ListPropertyCategories.usecase";
import { ReportUserUseCase } from "@/application/users/ReportUser.usecase";
import { GetRecentlyViewedUseCase } from "@/application/properties/GetRecentlyViewed.usecase";
import { GetRecommendationsUseCase } from "@/application/properties/GetRecommendations.usecase";

// Application (chat, Phase 5 Part 1)
import { StartConversationUseCase } from "@/application/chat/StartConversation.usecase";
import { SendMessageUseCase } from "@/application/chat/SendMessage.usecase";
import { ListConversationsUseCase } from "@/application/chat/ListConversations.usecase";
import { ListMessagesUseCase } from "@/application/chat/ListMessages.usecase";
import { MarkConversationReadUseCase } from "@/application/chat/MarkConversationRead.usecase";
import { DeleteMessageUseCase } from "@/application/chat/DeleteMessage.usecase";
import { SendTypingIndicatorUseCase } from "@/application/chat/SendTypingIndicator.usecase";
import { GetUnreadMessageCountUseCase } from "@/application/chat/GetUnreadMessageCount.usecase";

// Application (notifications, Phase 5 Part 2)
import { RegisterPushTokenUseCase } from "@/application/notifications/RegisterPushToken.usecase";
import {
  GetNotificationPreferencesUseCase,
  UpdateNotificationPreferencesUseCase,
} from "@/application/notifications/NotificationPreferences";

// Application (WhatsApp, Phase 5 Part 4)
import { ContactOwnerUseCase } from "@/application/whatsapp/ContactOwner.usecase";
import { SharePropertyUseCase } from "@/application/whatsapp/ShareProperty.usecase";
import { SendInquiryUseCase } from "@/application/whatsapp/SendInquiry.usecase";

// Application (saved searches, Phase 5 Part 5)
import { CreateSavedSearchUseCase } from "@/application/savedsearches/CreateSavedSearch.usecase";
import { ListSavedSearchesUseCase } from "@/application/savedsearches/ListSavedSearches.usecase";
import { UpdateSavedSearchUseCase } from "@/application/savedsearches/UpdateSavedSearch.usecase";
import { DeleteSavedSearchUseCase } from "@/application/savedsearches/DeleteSavedSearch.usecase";
import { NotifySavedSearchesForPropertyUseCase } from "@/application/savedsearches/NotifySavedSearchesForProperty.usecase";

// Application (admin use-cases, Phase 4)
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

// Interface layer
import { AuthController } from "@/interfaces/http/controllers/AuthController";
import { UserController } from "@/interfaces/http/controllers/UserController";
import { NotificationController } from "@/interfaces/http/controllers/NotificationController";
import { PropertyController } from "@/interfaces/http/controllers/PropertyController";
import { VerificationController } from "@/interfaces/http/controllers/VerificationController";
import { AdminUserController } from "@/interfaces/http/controllers/AdminUserController";
import { AdminPropertyController } from "@/interfaces/http/controllers/AdminPropertyController";
import { AdminReportController } from "@/interfaces/http/controllers/AdminReportController";
import { AdminVerificationController } from "@/interfaces/http/controllers/AdminVerificationController";
import { AdminNotificationController } from "@/interfaces/http/controllers/AdminNotificationController";
import { AdminDashboardController } from "@/interfaces/http/controllers/AdminDashboardController";
import { AdminAuditController } from "@/interfaces/http/controllers/AdminAuditController";
import { ChatController } from "@/interfaces/http/controllers/ChatController";
import { WhatsAppController } from "@/interfaces/http/controllers/WhatsAppController";
import { SavedSearchController } from "@/interfaces/http/controllers/SavedSearchController";
import { authenticate as authenticateFactory } from "@/interfaces/http/middleware/authenticate";
import { optionalAuthenticate as optionalAuthenticateFactory } from "@/interfaces/http/middleware/optionalAuthenticate";
import { createAuthRateLimiter } from "@/interfaces/http/middleware/rateLimiter";

export function buildContainer() {
  // --- infrastructure ---
  const userRepo = new UserRepository(pool);
  const roleRepo = new RoleRepository(pool);
  const userRoleRepo = new UserRoleRepository(pool);
  const userDeviceRepo = new UserDeviceRepository(pool);
  const sessionRepo = new SessionRepository(pool);
  const refreshTokenRepo = new RefreshTokenRepository(pool);
  const otpRepo = new OtpRepository(pool);
  const notificationRepo = new NotificationRepository(pool);
  const userPreferenceRepo = new UserPreferenceRepository(pool);
  const auditLogRepo = new AuditLogRepository(pool);
  const activityLogRepo = new ActivityLogRepository(pool);

  const propertyRepo = new PropertyRepository(pool);
  const propertyCategoryRepo = new PropertyCategoryRepository(pool);
  const propertyLocationRepo = new PropertyLocationRepository(pool);
  const propertyImageRepo = new PropertyImageRepository(pool);
  const propertyFeatureRepo = new PropertyFeatureRepository(pool);
  const propertyViewRepo = new PropertyViewRepository(pool);
  const propertyFavoriteRepo = new PropertyFavoriteRepository(pool);
  const propertyReportRepo = new PropertyReportRepository(pool);
  const propertyStatusHistoryRepo = new PropertyStatusHistoryRepository(pool);
  const userReportRepo = new UserReportRepository(pool);
  const identityVerificationRepo = new IdentityVerificationRepository(pool);
  const adminAnalyticsRepo = new AdminAnalyticsRepository(pool);
  const conversationRepo = new ConversationRepository(pool);
  const messageRepo = new MessageRepository(pool);
  const savedSearchRepo = new SavedSearchRepository(pool);

  const imageStorage = new CloudinaryImageStorageService(env.cloudinary);
  const geocodingService = new GoogleGeocodingService(env.googleMapsApiKey);
  const healthCheckService = new PostgresHealthCheckService(pool);

  const hasher = new BcryptHasher(env.bcryptSaltRounds);
  const tokenService = new JwtTokenService({
    secret: env.jwt.accessSecret,
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
    accessTokenTtlSeconds: env.jwt.accessTokenTtlSeconds,
  });
  const otpGenerator = new CryptoOtpGenerator();
  const clock = new SystemClock();

  // --- Phase 5: real-time chat transport ---
  // Shares the app's http.Server via server.ts calling
  // realtimeGateway.attach(server) after app.listen() -- see docs/phase-5.md.
  const realtimeGateway = new WebSocketGateway(tokenService);

  // --- Phase 5: push notifications (Part 2) ---
  // FCM only if real credentials are configured; otherwise the same
  // honest console fallback used since Phase 4.
  const pushService = env.firebase.projectId
    ? new FcmPushNotificationService(env.firebase, userDeviceRepo)
    : new ConsolePushNotificationService();

  // --- Phase 5: email & SMS providers (Part 3) ---
  const emailService = env.smtp.host ? new SmtpEmailService(env.smtp) : new ConsoleEmailService();
  const smsService = env.twilio.accountSid
    ? new TwilioSmsService(env.twilio)
    : new ConsoleSmsService();
  const notificationSender = new ChannelNotificationSender(emailService, smsService);

  // --- Phase 5: WhatsApp Business API (Part 4) ---
  const whatsAppService = env.whatsapp.phoneNumberId
    ? new WhatsAppCloudApiService(env.whatsapp)
    : new ConsoleWhatsAppService();

  const authConfig: AuthConfig = {
    accessTokenTtlSeconds: env.jwt.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: env.refreshTokenTtlSeconds,
    otpLength: env.otp.length,
    otpTtlSeconds: env.otp.ttlSeconds,
    otpMaxAttempts: env.otp.maxAttempts,
  };

  // --- shared application services ---
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

  // --- use-cases ---
  const registerUser = new RegisterUserUseCase(
    userRepo,
    roleRepo,
    userRoleRepo,
    userPreferenceRepo,
    auditLogRepo,
    hasher,
    sessionIssuer,
    otpIssuer,
    emailService,
  );
  const loginUser = new LoginUserUseCase(
    userRepo,
    userRoleRepo,
    auditLogRepo,
    hasher,
    clock,
    sessionIssuer,
    otpIssuer,
  );
  const verifyOtp = new VerifyOtpUseCase(
    userRepo,
    userRoleRepo,
    auditLogRepo,
    clock,
    sessionIssuer,
    otpVerifier,
  );
  const refreshToken = new RefreshTokenUseCase(
    refreshTokenRepo,
    sessionRepo,
    userRoleRepo,
    auditLogRepo,
    tokenService,
    clock,
    authConfig,
  );
  const logoutUser = new LogoutUserUseCase(refreshTokenRepo, sessionRepo, auditLogRepo, tokenService);
  const logoutAllDevices = new LogoutAllDevicesUseCase(refreshTokenRepo, sessionRepo, auditLogRepo);
  const forgotPassword = new ForgotPasswordUseCase(userRepo, auditLogRepo, otpIssuer);
  const resetPassword = new ResetPasswordUseCase(
    userRepo,
    refreshTokenRepo,
    sessionRepo,
    auditLogRepo,
    notificationRepo,
    hasher,
    otpVerifier,
  );

  const getMe = new GetMeUseCase(userRepo, userRoleRepo, userPreferenceRepo);
  const updateMe = new UpdateMeUseCase(
    userRepo,
    userRoleRepo,
    userPreferenceRepo,
    activityLogRepo,
    otpIssuer,
  );
  const deleteMe = new DeleteMeUseCase(userRepo, refreshTokenRepo, sessionRepo, auditLogRepo);

  const listNotifications = new ListNotificationsUseCase(notificationRepo);
  const markNotificationsRead = new MarkNotificationsReadUseCase(notificationRepo, activityLogRepo);

  // --- properties ---
  const propertyDetailLoader = new PropertyDetailLoader(
    propertyCategoryRepo,
    userRepo,
    propertyLocationRepo,
    propertyImageRepo,
    propertyFeatureRepo,
    propertyFavoriteRepo,
  );

  const createProperty = new CreatePropertyUseCase(
    propertyRepo,
    propertyCategoryRepo,
    propertyLocationRepo,
    propertyFeatureRepo,
    propertyStatusHistoryRepo,
    geocodingService,
    propertyDetailLoader,
  );
  const getProperty = new GetPropertyUseCase(propertyRepo, propertyViewRepo, propertyDetailLoader);
  const searchProperties = new SearchPropertiesUseCase(
    propertyRepo,
    propertyLocationRepo,
    propertyImageRepo,
    propertyCategoryRepo,
  );
  const updateProperty = new UpdatePropertyUseCase(
    propertyRepo,
    propertyLocationRepo,
    propertyFeatureRepo,
    propertyStatusHistoryRepo,
    geocodingService,
    clock,
    propertyDetailLoader,
  );
  const deleteProperty = new DeletePropertyUseCase(propertyRepo, propertyStatusHistoryRepo);
  const uploadPropertyImagesUseCase = new UploadPropertyImagesUseCase(
    propertyRepo,
    propertyImageRepo,
    imageStorage,
  );
  const deletePropertyImageUseCase = new DeletePropertyImageUseCase(
    propertyRepo,
    propertyImageRepo,
    imageStorage,
  );
  const favoriteProperty = new FavoritePropertyUseCase(propertyRepo, propertyFavoriteRepo, activityLogRepo);
  const unfavoriteProperty = new UnfavoritePropertyUseCase(
    propertyRepo,
    propertyFavoriteRepo,
    activityLogRepo,
  );
  const reportProperty = new ReportPropertyUseCase(propertyRepo, propertyReportRepo, auditLogRepo);
  const getMyProperties = new GetMyPropertiesUseCase(propertyRepo, propertyDetailLoader);
  const getMyFavorites = new GetMyFavoritesUseCase(propertyRepo, propertyFavoriteRepo, propertyDetailLoader);
  const listPropertyCategories = new ListPropertyCategoriesUseCase(propertyCategoryRepo);
  const reportUser = new ReportUserUseCase(userRepo, userReportRepo, auditLogRepo);
  const getRecentlyViewed = new GetRecentlyViewedUseCase(propertyRepo, propertyViewRepo, propertyDetailLoader);
  const getRecommendations = new GetRecommendationsUseCase(
    propertyRepo,
    propertyLocationRepo,
    propertyFavoriteRepo,
    propertyDetailLoader,
  );

  // --- chat (Phase 5 Part 1) ---
  const startConversation = new StartConversationUseCase(conversationRepo, userRepo, propertyRepo);
  const sendMessage = new SendMessageUseCase(
    conversationRepo,
    messageRepo,
    notificationRepo,
    userRepo,
    userPreferenceRepo,
    imageStorage,
    pushService,
    realtimeGateway,
  );
  const listConversations = new ListConversationsUseCase(conversationRepo, userRepo, propertyRepo);
  const listMessages = new ListMessagesUseCase(conversationRepo, messageRepo);
  const markConversationRead = new MarkConversationReadUseCase(conversationRepo, realtimeGateway, clock);
  const deleteMessage = new DeleteMessageUseCase(conversationRepo, messageRepo, realtimeGateway);
  const sendTypingIndicator = new SendTypingIndicatorUseCase(conversationRepo, realtimeGateway);
  const getUnreadMessageCount = new GetUnreadMessageCountUseCase(conversationRepo);

  // Inbound WebSocket events (typing, read receipts) are routed to the
  // same use-cases the REST API uses -- the transport differs, the
  // business logic doesn't. See WebSocketGateway.onInboundMessage's doc
  // comment for the wire format.
  realtimeGateway.onInboundMessage((userId, data) => {
    const message = data as { type?: string; conversationId?: string; isTyping?: boolean };
    if (!message || typeof message.conversationId !== "string") return;

    if (message.type === "typing") {
      void sendTypingIndicator.execute({
        conversationId: message.conversationId,
        userId,
        isTyping: Boolean(message.isTyping),
      });
    } else if (message.type === "read") {
      void markConversationRead.execute({ conversationId: message.conversationId, userId });
    }
  });

  // --- notification preferences & device tokens (Phase 5 Part 2) ---
  const registerPushToken = new RegisterPushTokenUseCase(userDeviceRepo);
  const getNotificationPreferences = new GetNotificationPreferencesUseCase(userPreferenceRepo);
  const updateNotificationPreferences = new UpdateNotificationPreferencesUseCase(userPreferenceRepo);

  // --- WhatsApp (Phase 5 Part 4) ---
  const contactOwner = new ContactOwnerUseCase(propertyRepo, userRepo, whatsAppService);
  const shareProperty = new SharePropertyUseCase(propertyRepo, whatsAppService);
  const sendInquiry = new SendInquiryUseCase(propertyRepo, userRepo, whatsAppService);

  // --- saved searches (Phase 5 Part 5) ---
  const createSavedSearch = new CreateSavedSearchUseCase(savedSearchRepo);
  const listSavedSearches = new ListSavedSearchesUseCase(savedSearchRepo);
  const updateSavedSearch = new UpdateSavedSearchUseCase(savedSearchRepo);
  const deleteSavedSearch = new DeleteSavedSearchUseCase(savedSearchRepo);

  // --- admin: users (Phase 4 Part 2) ---
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

  // --- admin: property moderation (Phase 4 Part 3) ---
  const adminSearchProperties = new AdminSearchPropertiesUseCase(propertyRepo);
  const notifySavedSearchesForProperty = new NotifySavedSearchesForPropertyUseCase(
    savedSearchRepo,
    propertyLocationRepo,
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

  // --- admin: report management (Phase 4 Part 4) ---
  const listPropertyReports = new ListPropertyReportsUseCase(propertyReportRepo);
  const updatePropertyReportStatus = new UpdatePropertyReportStatusUseCase(propertyReportRepo, auditLogRepo);
  const listUserReports = new ListUserReportsUseCase(userReportRepo);
  const updateUserReportStatus = new UpdateUserReportStatusUseCase(userReportRepo, auditLogRepo);

  // --- owner verification (Phase 4 Part 5) ---
  const submitIdentityVerification = new SubmitIdentityVerificationUseCase(
    identityVerificationRepo,
    imageStorage,
  );
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

  // --- admin: notifications (Phase 4 Part 6) ---
  const broadcastNotification = new BroadcastNotificationUseCase(
    userRepo,
    notificationRepo,
    pushService,
    auditLogRepo,
  );

  // --- admin: analytics (Phase 4 Part 7) ---
  const getDashboardStats = new GetDashboardStatsUseCase(adminAnalyticsRepo);
  const getGrowthAnalytics = new GetGrowthAnalyticsUseCase(adminAnalyticsRepo);
  const getTopProperties = new GetTopPropertiesUseCase(adminAnalyticsRepo);

  // --- admin: audit logs (Phase 4 Part 8) ---
  const searchAuditLogs = new SearchAuditLogsUseCase(auditLogRepo);

  // --- admin: system health (Phase 4 Part 1) ---
  const getSystemHealth = new GetSystemHealthUseCase(healthCheckService);

  // --- interface layer ---
  const authController = new AuthController(
    registerUser,
    loginUser,
    verifyOtp,
    refreshToken,
    logoutUser,
    logoutAllDevices,
    forgotPassword,
    resetPassword,
  );
  const userController = new UserController(getMe, updateMe, deleteMe, reportUser);
  const notificationController = new NotificationController(
    listNotifications,
    markNotificationsRead,
    registerPushToken,
    getNotificationPreferences,
    updateNotificationPreferences,
  );
  const chatController = new ChatController(
    startConversation,
    sendMessage,
    listConversations,
    listMessages,
    markConversationRead,
    deleteMessage,
    getUnreadMessageCount,
  );
  const whatsAppController = new WhatsAppController(
    contactOwner,
    shareProperty,
    sendInquiry,
    env.frontendBaseUrl,
  );
  const savedSearchController = new SavedSearchController(
    createSavedSearch,
    listSavedSearches,
    updateSavedSearch,
    deleteSavedSearch,
  );
  const verificationController = new VerificationController(
    submitIdentityVerification,
    getMyVerificationStatus,
  );
  const adminUserController = new AdminUserController(
    searchUsers,
    getUserProfile,
    updateUserStatus,
    adminDeleteUser,
    adminResetUserPassword,
    updateUserRoles,
    getUserActivity,
  );
  const adminPropertyController = new AdminPropertyController(
    adminSearchProperties,
    approveProperty,
    rejectProperty,
    hideProperty,
    unhideProperty,
    featureProperty,
    unfeatureProperty,
    bulkModerateProperties,
    getPropertyModerationHistory,
  );
  const adminReportController = new AdminReportController(
    listPropertyReports,
    updatePropertyReportStatus,
    listUserReports,
    updateUserReportStatus,
  );
  const adminVerificationController = new AdminVerificationController(
    listIdentityVerifications,
    approveIdentityVerification,
    rejectIdentityVerification,
  );
  const adminNotificationController = new AdminNotificationController(broadcastNotification);
  const adminDashboardController = new AdminDashboardController(
    getDashboardStats,
    getGrowthAnalytics,
    getTopProperties,
    getSystemHealth,
  );
  const adminAuditController = new AdminAuditController(searchAuditLogs);
  const propertyController = new PropertyController(
    createProperty,
    getProperty,
    searchProperties,
    updateProperty,
    deleteProperty,
    uploadPropertyImagesUseCase,
    deletePropertyImageUseCase,
    favoriteProperty,
    unfavoriteProperty,
    reportProperty,
    getMyProperties,
    getMyFavorites,
    listPropertyCategories,
    getRecentlyViewed,
    getRecommendations,
  );

  const authenticate = authenticateFactory(tokenService);
  const optionalAuthenticate = optionalAuthenticateFactory(tokenService);
  const authRateLimiter = createAuthRateLimiter(env.rateLimit.authWindowMs, env.rateLimit.authMax);

  return {
    authController,
    userController,
    notificationController,
    propertyController,
    verificationController,
    chatController,
    whatsAppController,
    savedSearchController,
    adminUserController,
    adminPropertyController,
    adminReportController,
    adminVerificationController,
    adminNotificationController,
    adminDashboardController,
    adminAuditController,
    authenticate,
    optionalAuthenticate,
    authRateLimiter,
    realtimeGateway,
  };
}

export type Container = ReturnType<typeof buildContainer>;
