// Mirrors the DTOs returned by the Phase 3 backend (see
// backend/src/application/properties/shared/PropertyDetailDTO.ts and
// backend/src/interfaces/http/controllers/PropertyController.ts). Kept as
// plain types, not classes, since this is pure wire-format data.

export type PropertyType =
  | "apartment"
  | "house"
  | "villa"
  | "studio"
  | "pg"
  | "room"
  | "commercial"
  | "other";

export type PropertyStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rented"
  | "inactive"
  | "removed"
  | "rejected";

export type Facing =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north_east"
  | "north_west"
  | "south_east"
  | "south_west";

export type FurnishedStatus = "unfurnished" | "semi_furnished" | "fully_furnished";

export type SortOption = "newest" | "most_viewed" | "price_low_to_high" | "price_high_to_low";

export const PROPERTY_FEATURE_KEYS = [
  "gym",
  "swimming_pool",
  "power_backup",
  "lift",
  "security",
  "park",
  "club_house",
  "wifi",
  "pet_friendly",
  "water_supply",
  "cctv",
  "fire_safety",
  "intercom",
  "rain_water_harvesting",
  "gas_pipeline",
  "servant_room",
] as const;

export type PropertyFeatureKey = (typeof PROPERTY_FEATURE_KEYS)[number];

export interface PropertyCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface PropertySummary {
  id: string;
  title: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  rentAmount: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  furnishedStatus: FurnishedStatus;
  availableFrom: string;
  viewCount: number;
  favoriteCount: number;
  createdAt: string;
  city: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryImageUrl: string | null;
  categoryName: string | null;
  distanceKm: number | null;
}

export interface PropertyImageDTO {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  width: number | null;
  height: number | null;
}

export interface PropertyLocationDTO {
  addressLine: string;
  city: string;
  locality: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
}

export interface PropertyDetail {
  id: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  rentAmount: number;
  securityDeposit: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorNumber: number | null;
  totalFloors: number | null;
  facing: Facing | null;
  furnishedStatus: FurnishedStatus;
  availableFrom: string;
  viewCount: number;
  favoriteCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string } | null;
  owner: { id: string; name: string } | null;
  location: PropertyLocationDTO | null;
  images: PropertyImageDTO[];
  features: string[];
  isFavorited: boolean | null;
  distanceKm: number | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchFilters {
  category?: string;
  propertyType?: PropertyType;
  rentMin?: number;
  rentMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  parkingMin?: number;
  areaMin?: number;
  areaMax?: number;
  city?: string;
  locality?: string;
  furnished?: FurnishedStatus;
  availableFrom?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort: SortOption;
  page: number;
  pageSize: number;
}

export interface PropertyFormLocationInput {
  addressLine: string;
  city: string;
  locality?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface CreatePropertyPayload {
  title: string;
  description: string;
  categoryId: string;
  propertyType: PropertyType;
  rentAmount: number;
  securityDeposit: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorNumber?: number;
  totalFloors?: number;
  facing?: Facing;
  furnishedStatus: FurnishedStatus;
  availableFrom: string;
  features?: string[];
  location: PropertyFormLocationInput;
}

// Bug fix (QA report #14 + #15): this used to type `status` as the full
// PropertyStatus union (including "rejected", which the backend's
// updatePropertySchema does not accept on update -- see
// backend/.../validators/property.schemas.ts's statusEnum), and typed
// floorNumber/totalFloors/facing as non-nullable, so there was no way
// through this client to send the `null` the backend explicitly accepts
// for those three fields to clear a previously-set value on edit.
export type UpdatablePropertyStatus = Exclude<PropertyStatus, "rejected">;

export type UpdatePropertyPayload = Partial<
  Omit<CreatePropertyPayload, "location" | "floorNumber" | "totalFloors" | "facing">
> & {
  status?: UpdatablePropertyStatus;
  location?: Partial<PropertyFormLocationInput>;
  floorNumber?: number | null;
  totalFloors?: number | null;
  facing?: Facing | null;
};

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Phase 4 (Owner Verification) addition -- additive to the Phase 2 shape. */
  identityVerified: boolean;
  roles: string[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

// ============================================================
// Phase 4: Admin Panel, Moderation, Production Operations
// ============================================================

export type UserStatus = "active" | "suspended" | "banned";

/** Admin's user-list/profile shape mirrors PublicUser exactly (the admin
 * panel never needs the password hash or other private fields the backend
 * withholds already). */
export type AdminUserSummary = PublicUser;

export interface ActivityLogRecord {
  id: string;
  userId: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminUserProfile extends PublicUser {
  preferences: { language: string; timezone: string; notifyEmail: boolean; notifySms: boolean; notifyPush: boolean } | null;
  propertyCount: number;
  recentActivity: ActivityLogRecord[];
}

/** The admin moderation shape is the raw Property entity (not the public
 * PropertySummary DTO) -- admins need every status/moderation field, and
 * the admin panel resolves owner/category names client-side from the id
 * when needed rather than requiring the backend to join them in. */
export interface AdminProperty {
  id: string;
  ownerId: string;
  categoryId: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  rentAmount: number;
  securityDeposit: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  furnishedStatus: FurnishedStatus;
  availableFrom: string;
  viewCount: number;
  favoriteCount: number;
  publishedAt: string | null;
  isFeatured: boolean;
  moderatedBy: string | null;
  moderatedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminPropertySort = "newest" | "oldest" | "most_viewed" | "most_favorited";

export interface AdminPropertySearchFilters {
  status?: AdminProperty["status"];
  categoryId?: string;
  ownerId?: string;
  isFeatured?: boolean;
  city?: string;
  sort: AdminPropertySort;
  page: number;
  pageSize: number;
}

export interface PropertyStatusHistoryRecord {
  id: string;
  propertyId: string;
  previousStatus: PropertyStatus | "rejected" | null;
  newStatus: PropertyStatus | "rejected";
  changedBy: string | null;
  reason: string | null;
  createdAt: string;
}

export type BulkModerationAction =
  | "approve"
  | "reject"
  | "hide"
  | "unhide"
  | "feature"
  | "unfeature"
  | "delete";

export interface BulkModerationResultItem {
  propertyId: string;
  success: boolean;
  error?: string;
}

export type ReportStatus = "pending" | "reviewed" | "dismissed" | "action_taken";

export interface PropertyReportRecord {
  id: string;
  propertyId: string;
  reporterUserId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserReportRecord {
  id: string;
  reportedUserId: string;
  reporterUserId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IdentityDocumentType = "government_id" | "passport" | "driving_license" | "other";
export type IdentityVerificationStatus = "pending" | "approved" | "rejected";

export interface IdentityVerificationRecord {
  id: string;
  userId: string;
  documentType: IdentityDocumentType;
  documentImageUrl: string;
  status: IdentityVerificationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyVerificationStatus {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  identityVerification: IdentityVerificationRecord | null;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  totalProperties: number;
  publishedProperties: number;
  pendingProperties: number;
  rejectedProperties: number;
  hiddenProperties: number;
  featuredProperties: number;
  totalViews: number;
  totalFavorites: number;
  pendingPropertyReports: number;
  pendingUserReports: number;
  pendingVerifications: number;
}

export type GrowthMetric = "users" | "properties" | "views" | "favorites" | "reports";

export interface GrowthPoint {
  date: string;
  count: number;
}

export interface GrowthAnalyticsResult {
  metric: GrowthMetric;
  days: number;
  points: GrowthPoint[];
}

export type TopPropertiesMetric = "most_viewed" | "most_favorited";

export interface PropertyAnalyticsRow {
  propertyId: string;
  title: string;
  ownerId: string;
  viewCount: number;
  favoriteCount: number;
}

export interface SystemHealthReport {
  status: "ok" | "degraded";
  database: "ok" | "error";
  uptimeSeconds: number;
  nodeVersion: string;
  timestamp: string;
}

// ==========================================================================
// Phase 5: Chat, Notifications, WhatsApp, Saved Searches, Recommendations
// ==========================================================================

export interface ConversationSummary {
  id: string;
  propertyId: string | null;
  propertyTitle: string | null;
  otherParticipant: { id: string; name: string } | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageDto {
  id: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  isMine: boolean;
  isDeleted: boolean;
  readByOther: boolean;
}

/** The shape the backend's WebSocketGateway actually puts on the wire for
 * "message.new" -- the raw Message entity (see backend
 * src/domain/entities/Message.ts), NOT a MessageDto. It has no
 * isMine/isDeleted/readByOther -- those are derived client-side in
 * useChatSocket's consumers, the same way ListMessagesUseCase derives them
 * server-side for the initial page load. */
export interface RawMessageEvent {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type ChatRealtimeEvent =
  | { type: "message.new"; conversationId: string; message: RawMessageEvent }
  | { type: "message.deleted"; conversationId: string; messageId: string }
  | { type: "typing"; conversationId: string; userId: string; isTyping: boolean }
  | { type: "conversation.read"; conversationId: string; userId: string; at: string };

export interface NotificationCategoryPreferences {
  newProperties: boolean;
  newMessages: boolean;
  favoriteUpdates: boolean;
  adminAnnouncements: boolean;
}

export interface NotificationPreferences {
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  categories: NotificationCategoryPreferences;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface SavedSearchFilters {
  categoryId?: string;
  propertyType?: PropertyType;
  rentMin?: number;
  rentMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  parkingMin?: number;
  areaMin?: number;
  areaMax?: number;
  city?: string;
  locality?: string;
  furnished?: FurnishedStatus;
  availableFrom?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: SavedSearchFilters;
  notifyOnMatch: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Phase 6 Part 1: Payments -------------------------------------------

export type PaymentGatewayName = "razorpay" | "stripe";
export type BoostType = "featured" | "boost";

export interface PaymentPublicConfig {
  razorpayKeyId: string;
  stripePublishableKey: string;
}

export interface PremiumPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  durationDays: number;
  features: string[];
  isActive: boolean;
}

export interface CreateOrderResult {
  paymentOrderId: string;
  gateway: PaymentGatewayName;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  /** Stripe: { clientSecret }. Razorpay needs nothing extra beyond the order id + public key. */
  providerData?: Record<string, unknown>;
}

export type PaymentStatus = "succeeded" | "failed" | "refunded" | "partially_refunded";

export interface PaymentRecord {
  id: string;
  paymentOrderId: string;
  gateway: PaymentGatewayName;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  paymentId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  lineDescription: string;
  issuedAt: string;
}
