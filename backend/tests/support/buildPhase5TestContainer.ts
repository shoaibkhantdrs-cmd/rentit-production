import { StartConversationUseCase } from "@/application/chat/StartConversation.usecase";
import { SendMessageUseCase } from "@/application/chat/SendMessage.usecase";
import { ListConversationsUseCase } from "@/application/chat/ListConversations.usecase";
import { ListMessagesUseCase } from "@/application/chat/ListMessages.usecase";
import { MarkConversationReadUseCase } from "@/application/chat/MarkConversationRead.usecase";
import { DeleteMessageUseCase } from "@/application/chat/DeleteMessage.usecase";
import { SendTypingIndicatorUseCase } from "@/application/chat/SendTypingIndicator.usecase";
import { GetUnreadMessageCountUseCase } from "@/application/chat/GetUnreadMessageCount.usecase";

import { RegisterPushTokenUseCase } from "@/application/notifications/RegisterPushToken.usecase";
import {
  GetNotificationPreferencesUseCase,
  UpdateNotificationPreferencesUseCase,
} from "@/application/notifications/NotificationPreferences";

import { ContactOwnerUseCase } from "@/application/whatsapp/ContactOwner.usecase";
import { SharePropertyUseCase } from "@/application/whatsapp/ShareProperty.usecase";
import { SendInquiryUseCase } from "@/application/whatsapp/SendInquiry.usecase";

import { CreateSavedSearchUseCase } from "@/application/savedsearches/CreateSavedSearch.usecase";
import { ListSavedSearchesUseCase } from "@/application/savedsearches/ListSavedSearches.usecase";
import { UpdateSavedSearchUseCase } from "@/application/savedsearches/UpdateSavedSearch.usecase";
import { DeleteSavedSearchUseCase } from "@/application/savedsearches/DeleteSavedSearch.usecase";
import { NotifySavedSearchesForPropertyUseCase } from "@/application/savedsearches/NotifySavedSearchesForProperty.usecase";

import { GetRecentlyViewedUseCase } from "@/application/properties/GetRecentlyViewed.usecase";
import { GetRecommendationsUseCase } from "@/application/properties/GetRecommendations.usecase";
import { PropertyDetailLoader } from "@/application/properties/shared/PropertyDetailLoader";

import { FakeClock } from "./fakes/FakeClock";
import { FakeImageStorageService } from "./fakes/FakeImageStorageService";
import { FakePushNotificationService } from "./fakes/FakePushNotificationService";
import { FakeEmailService } from "./fakes/FakeEmailService";
import { FakeSmsService } from "./fakes/FakeSmsService";
import { FakeWhatsAppService } from "./fakes/FakeWhatsAppService";
import { InMemoryRealtimeGateway } from "./fakes/InMemoryRealtimeGateway";

import { InMemoryUserRepository } from "./fakes/InMemoryUserRepository";
import { InMemoryRoleRepository } from "./fakes/InMemoryRoleRepository";
import { InMemoryUserRoleRepository } from "./fakes/InMemoryUserRoleRepository";
import { InMemoryUserPreferenceRepository } from "./fakes/InMemoryUserPreferenceRepository";
import { InMemoryUserDeviceRepository } from "./fakes/InMemoryUserDeviceRepository";
import { InMemoryNotificationRepository } from "./fakes/InMemoryNotificationRepository";

import { InMemoryPropertyRepository } from "./fakes/InMemoryPropertyRepository";
import { InMemoryPropertyLocationRepository } from "./fakes/InMemoryPropertyLocationRepository";
import { InMemoryPropertyCategoryRepository } from "./fakes/InMemoryPropertyCategoryRepository";
import { InMemoryPropertyImageRepository } from "./fakes/InMemoryPropertyImageRepository";
import { InMemoryPropertyFeatureRepository } from "./fakes/InMemoryPropertyFeatureRepository";
import { InMemoryPropertyFavoriteRepository } from "./fakes/InMemoryPropertyFavoriteRepository";
import { InMemoryPropertyViewRepository } from "./fakes/InMemoryPropertyViewRepository";

import { InMemoryConversationRepository } from "./fakes/InMemoryConversationRepository";
import { InMemoryMessageRepository } from "./fakes/InMemoryMessageRepository";
import { InMemorySavedSearchRepository } from "./fakes/InMemorySavedSearchRepository";

/**
 * Wires every net-new Phase 5 use-case (chat, notification preferences,
 * WhatsApp, saved searches, recently viewed, recommendations) against
 * in-memory fakes. RegisterUserUseCase and ApprovePropertyUseCase gained
 * additive Phase 5 dependencies too, but those are covered by
 * buildTestContainer.ts / buildAdminTestContainer.ts respectively, which
 * already existed and were updated in place -- this container is only for
 * the use-cases that are entirely new in Phase 5.
 */
export function buildPhase5TestContainer() {
  const clock = new FakeClock();
  const imageStorage = new FakeImageStorageService();
  const pushService = new FakePushNotificationService();
  const emailService = new FakeEmailService();
  const smsService = new FakeSmsService();
  const whatsAppService = new FakeWhatsAppService();
  const realtimeGateway = new InMemoryRealtimeGateway();

  const userRepo = new InMemoryUserRepository();
  const roleRepo = new InMemoryRoleRepository();
  const userRoleRepo = new InMemoryUserRoleRepository(roleRepo);
  userRepo.setUserRoleRepo(userRoleRepo);
  const userPreferenceRepo = new InMemoryUserPreferenceRepository();
  const userDeviceRepo = new InMemoryUserDeviceRepository();
  const notificationRepo = new InMemoryNotificationRepository();

  const locationRepo = new InMemoryPropertyLocationRepository();
  const propertyRepo = new InMemoryPropertyRepository(locationRepo);
  const propertyCategoryRepo = new InMemoryPropertyCategoryRepository();
  const propertyImageRepo = new InMemoryPropertyImageRepository();
  const propertyFeatureRepo = new InMemoryPropertyFeatureRepository();
  const propertyFavoriteRepo = new InMemoryPropertyFavoriteRepository();
  const propertyViewRepo = new InMemoryPropertyViewRepository(clock);

  // InMemoryConversationRepository needs the message store to compute
  // unread counts -- see its constructor doc comment.
  const messageRepo = new InMemoryMessageRepository(clock);
  const conversationRepo = new InMemoryConversationRepository(messageRepo);

  const savedSearchRepo = new InMemorySavedSearchRepository();

  const propertyDetailLoader = new PropertyDetailLoader(
    propertyCategoryRepo,
    userRepo,
    locationRepo,
    propertyImageRepo,
    propertyFeatureRepo,
    propertyFavoriteRepo,
  );

  // --- chat ---
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

  // --- notification preferences & device tokens ---
  const registerPushToken = new RegisterPushTokenUseCase(userDeviceRepo);
  const getNotificationPreferences = new GetNotificationPreferencesUseCase(userPreferenceRepo);
  const updateNotificationPreferences = new UpdateNotificationPreferencesUseCase(userPreferenceRepo);

  // --- WhatsApp ---
  const contactOwner = new ContactOwnerUseCase(propertyRepo, userRepo, whatsAppService);
  const shareProperty = new SharePropertyUseCase(propertyRepo, whatsAppService);
  const sendInquiry = new SendInquiryUseCase(propertyRepo, userRepo, whatsAppService);

  // --- saved searches ---
  const createSavedSearch = new CreateSavedSearchUseCase(savedSearchRepo);
  const listSavedSearches = new ListSavedSearchesUseCase(savedSearchRepo);
  const updateSavedSearch = new UpdateSavedSearchUseCase(savedSearchRepo);
  const deleteSavedSearch = new DeleteSavedSearchUseCase(savedSearchRepo);
  const notifySavedSearchesForProperty = new NotifySavedSearchesForPropertyUseCase(
    savedSearchRepo,
    locationRepo,
    notificationRepo,
    userPreferenceRepo,
    pushService,
    clock,
  );

  // --- recently viewed & recommendations ---
  const getRecentlyViewed = new GetRecentlyViewedUseCase(propertyRepo, propertyViewRepo, propertyDetailLoader);
  const getRecommendations = new GetRecommendationsUseCase(
    propertyRepo,
    locationRepo,
    propertyFavoriteRepo,
    propertyDetailLoader,
  );

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
