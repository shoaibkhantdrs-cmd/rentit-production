"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPhase5TestContainer = buildPhase5TestContainer;
const StartConversation_usecase_1 = require("@/application/chat/StartConversation.usecase");
const SendMessage_usecase_1 = require("@/application/chat/SendMessage.usecase");
const ListConversations_usecase_1 = require("@/application/chat/ListConversations.usecase");
const ListMessages_usecase_1 = require("@/application/chat/ListMessages.usecase");
const MarkConversationRead_usecase_1 = require("@/application/chat/MarkConversationRead.usecase");
const DeleteMessage_usecase_1 = require("@/application/chat/DeleteMessage.usecase");
const SendTypingIndicator_usecase_1 = require("@/application/chat/SendTypingIndicator.usecase");
const GetUnreadMessageCount_usecase_1 = require("@/application/chat/GetUnreadMessageCount.usecase");
const RegisterPushToken_usecase_1 = require("@/application/notifications/RegisterPushToken.usecase");
const NotificationPreferences_1 = require("@/application/notifications/NotificationPreferences");
const ContactOwner_usecase_1 = require("@/application/whatsapp/ContactOwner.usecase");
const ShareProperty_usecase_1 = require("@/application/whatsapp/ShareProperty.usecase");
const SendInquiry_usecase_1 = require("@/application/whatsapp/SendInquiry.usecase");
const CreateSavedSearch_usecase_1 = require("@/application/savedsearches/CreateSavedSearch.usecase");
const ListSavedSearches_usecase_1 = require("@/application/savedsearches/ListSavedSearches.usecase");
const UpdateSavedSearch_usecase_1 = require("@/application/savedsearches/UpdateSavedSearch.usecase");
const DeleteSavedSearch_usecase_1 = require("@/application/savedsearches/DeleteSavedSearch.usecase");
const NotifySavedSearchesForProperty_usecase_1 = require("@/application/savedsearches/NotifySavedSearchesForProperty.usecase");
const GetRecentlyViewed_usecase_1 = require("@/application/properties/GetRecentlyViewed.usecase");
const GetRecommendations_usecase_1 = require("@/application/properties/GetRecommendations.usecase");
const PropertyDetailLoader_1 = require("@/application/properties/shared/PropertyDetailLoader");
const FakeClock_1 = require("./fakes/FakeClock");
const FakeImageStorageService_1 = require("./fakes/FakeImageStorageService");
const FakePushNotificationService_1 = require("./fakes/FakePushNotificationService");
const FakeEmailService_1 = require("./fakes/FakeEmailService");
const FakeSmsService_1 = require("./fakes/FakeSmsService");
const FakeWhatsAppService_1 = require("./fakes/FakeWhatsAppService");
const InMemoryRealtimeGateway_1 = require("./fakes/InMemoryRealtimeGateway");
const InMemoryUserRepository_1 = require("./fakes/InMemoryUserRepository");
const InMemoryRoleRepository_1 = require("./fakes/InMemoryRoleRepository");
const InMemoryUserRoleRepository_1 = require("./fakes/InMemoryUserRoleRepository");
const InMemoryUserPreferenceRepository_1 = require("./fakes/InMemoryUserPreferenceRepository");
const InMemoryUserDeviceRepository_1 = require("./fakes/InMemoryUserDeviceRepository");
const InMemoryNotificationRepository_1 = require("./fakes/InMemoryNotificationRepository");
const InMemoryPropertyRepository_1 = require("./fakes/InMemoryPropertyRepository");
const InMemoryPropertyLocationRepository_1 = require("./fakes/InMemoryPropertyLocationRepository");
const InMemoryPropertyCategoryRepository_1 = require("./fakes/InMemoryPropertyCategoryRepository");
const InMemoryPropertyImageRepository_1 = require("./fakes/InMemoryPropertyImageRepository");
const InMemoryPropertyFeatureRepository_1 = require("./fakes/InMemoryPropertyFeatureRepository");
const InMemoryPropertyFavoriteRepository_1 = require("./fakes/InMemoryPropertyFavoriteRepository");
const InMemoryPropertyViewRepository_1 = require("./fakes/InMemoryPropertyViewRepository");
const InMemoryConversationRepository_1 = require("./fakes/InMemoryConversationRepository");
const InMemoryMessageRepository_1 = require("./fakes/InMemoryMessageRepository");
const InMemorySavedSearchRepository_1 = require("./fakes/InMemorySavedSearchRepository");
/**
 * Wires every net-new Phase 5 use-case (chat, notification preferences,
 * WhatsApp, saved searches, recently viewed, recommendations) against
 * in-memory fakes. RegisterUserUseCase and ApprovePropertyUseCase gained
 * additive Phase 5 dependencies too, but those are covered by
 * buildTestContainer.ts / buildAdminTestContainer.ts respectively, which
 * already existed and were updated in place -- this container is only for
 * the use-cases that are entirely new in Phase 5.
 */
function buildPhase5TestContainer() {
    const clock = new FakeClock_1.FakeClock();
    const imageStorage = new FakeImageStorageService_1.FakeImageStorageService();
    const pushService = new FakePushNotificationService_1.FakePushNotificationService();
    const emailService = new FakeEmailService_1.FakeEmailService();
    const smsService = new FakeSmsService_1.FakeSmsService();
    const whatsAppService = new FakeWhatsAppService_1.FakeWhatsAppService();
    const realtimeGateway = new InMemoryRealtimeGateway_1.InMemoryRealtimeGateway();
    const userRepo = new InMemoryUserRepository_1.InMemoryUserRepository();
    const roleRepo = new InMemoryRoleRepository_1.InMemoryRoleRepository();
    const userRoleRepo = new InMemoryUserRoleRepository_1.InMemoryUserRoleRepository(roleRepo);
    userRepo.setUserRoleRepo(userRoleRepo);
    const userPreferenceRepo = new InMemoryUserPreferenceRepository_1.InMemoryUserPreferenceRepository();
    const userDeviceRepo = new InMemoryUserDeviceRepository_1.InMemoryUserDeviceRepository();
    const notificationRepo = new InMemoryNotificationRepository_1.InMemoryNotificationRepository();
    const locationRepo = new InMemoryPropertyLocationRepository_1.InMemoryPropertyLocationRepository();
    const propertyRepo = new InMemoryPropertyRepository_1.InMemoryPropertyRepository(locationRepo);
    const propertyCategoryRepo = new InMemoryPropertyCategoryRepository_1.InMemoryPropertyCategoryRepository();
    const propertyImageRepo = new InMemoryPropertyImageRepository_1.InMemoryPropertyImageRepository();
    const propertyFeatureRepo = new InMemoryPropertyFeatureRepository_1.InMemoryPropertyFeatureRepository();
    const propertyFavoriteRepo = new InMemoryPropertyFavoriteRepository_1.InMemoryPropertyFavoriteRepository();
    const propertyViewRepo = new InMemoryPropertyViewRepository_1.InMemoryPropertyViewRepository(clock);
    // InMemoryConversationRepository needs the message store to compute
    // unread counts -- see its constructor doc comment.
    const messageRepo = new InMemoryMessageRepository_1.InMemoryMessageRepository(clock);
    const conversationRepo = new InMemoryConversationRepository_1.InMemoryConversationRepository(messageRepo);
    const savedSearchRepo = new InMemorySavedSearchRepository_1.InMemorySavedSearchRepository();
    const propertyDetailLoader = new PropertyDetailLoader_1.PropertyDetailLoader(propertyCategoryRepo, userRepo, locationRepo, propertyImageRepo, propertyFeatureRepo, propertyFavoriteRepo);
    // --- chat ---
    const startConversation = new StartConversation_usecase_1.StartConversationUseCase(conversationRepo, userRepo, propertyRepo);
    const sendMessage = new SendMessage_usecase_1.SendMessageUseCase(conversationRepo, messageRepo, notificationRepo, userRepo, userPreferenceRepo, imageStorage, pushService, realtimeGateway);
    const listConversations = new ListConversations_usecase_1.ListConversationsUseCase(conversationRepo, userRepo, propertyRepo);
    const listMessages = new ListMessages_usecase_1.ListMessagesUseCase(conversationRepo, messageRepo);
    const markConversationRead = new MarkConversationRead_usecase_1.MarkConversationReadUseCase(conversationRepo, realtimeGateway, clock);
    const deleteMessage = new DeleteMessage_usecase_1.DeleteMessageUseCase(conversationRepo, messageRepo, realtimeGateway);
    const sendTypingIndicator = new SendTypingIndicator_usecase_1.SendTypingIndicatorUseCase(conversationRepo, realtimeGateway);
    const getUnreadMessageCount = new GetUnreadMessageCount_usecase_1.GetUnreadMessageCountUseCase(conversationRepo);
    // --- notification preferences & device tokens ---
    const registerPushToken = new RegisterPushToken_usecase_1.RegisterPushTokenUseCase(userDeviceRepo);
    const getNotificationPreferences = new NotificationPreferences_1.GetNotificationPreferencesUseCase(userPreferenceRepo);
    const updateNotificationPreferences = new NotificationPreferences_1.UpdateNotificationPreferencesUseCase(userPreferenceRepo);
    // --- WhatsApp ---
    const contactOwner = new ContactOwner_usecase_1.ContactOwnerUseCase(propertyRepo, userRepo, whatsAppService);
    const shareProperty = new ShareProperty_usecase_1.SharePropertyUseCase(propertyRepo, whatsAppService);
    const sendInquiry = new SendInquiry_usecase_1.SendInquiryUseCase(propertyRepo, userRepo, whatsAppService);
    // --- saved searches ---
    const createSavedSearch = new CreateSavedSearch_usecase_1.CreateSavedSearchUseCase(savedSearchRepo);
    const listSavedSearches = new ListSavedSearches_usecase_1.ListSavedSearchesUseCase(savedSearchRepo);
    const updateSavedSearch = new UpdateSavedSearch_usecase_1.UpdateSavedSearchUseCase(savedSearchRepo);
    const deleteSavedSearch = new DeleteSavedSearch_usecase_1.DeleteSavedSearchUseCase(savedSearchRepo);
    const notifySavedSearchesForProperty = new NotifySavedSearchesForProperty_usecase_1.NotifySavedSearchesForPropertyUseCase(savedSearchRepo, locationRepo, notificationRepo, userPreferenceRepo, pushService, clock);
    // --- recently viewed & recommendations ---
    const getRecentlyViewed = new GetRecentlyViewed_usecase_1.GetRecentlyViewedUseCase(propertyRepo, propertyViewRepo, propertyDetailLoader);
    const getRecommendations = new GetRecommendations_usecase_1.GetRecommendationsUseCase(propertyRepo, locationRepo, propertyFavoriteRepo, propertyDetailLoader);
    return {
        clock,
        imageStorage,
        pushService,
        emailService,
        smsService,
        whatsAppService,
        realtimeGateway,
        startConversation,
        sendMessage,
        listConversations,
        listMessages,
        markConversationRead,
        deleteMessage,
        sendTypingIndicator,
        getUnreadMessageCount,
        registerPushToken,
        getNotificationPreferences,
        updateNotificationPreferences,
        contactOwner,
        shareProperty,
        sendInquiry,
        createSavedSearch,
        listSavedSearches,
        updateSavedSearch,
        deleteSavedSearch,
        notifySavedSearchesForProperty,
        getRecentlyViewed,
        getRecommendations,
        repos: {
            userRepo,
            roleRepo,
            userRoleRepo,
            userPreferenceRepo,
            userDeviceRepo,
            notificationRepo,
            propertyRepo,
            locationRepo,
            propertyCategoryRepo,
            propertyImageRepo,
            propertyFeatureRepo,
            propertyFavoriteRepo,
            propertyViewRepo,
            conversationRepo,
            messageRepo,
            savedSearchRepo,
        },
    };
}
