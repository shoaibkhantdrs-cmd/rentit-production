import { z } from "zod";

/** z.coerce.boolean() treats any non-empty string (including "false") as
 * true -- this maps the literal query-string values instead. */
const booleanQueryParam = z.preprocess((val) => {
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}, z.boolean().optional());

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

// --- Part 2: User Management ---

const userStatusEnum = z.enum(["active", "suspended", "banned"]);

export const searchUsersQuerySchema = z.object({
  query: z.string().max(200).optional(),
  status: userStatusEnum.optional(),
  role: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUserStatusSchema = z.object({
  status: userStatusEnum,
  reason: z.string().max(500).optional(),
});

export const updateUserRolesSchema = z.object({
  roleNames: z.array(z.string().min(1).max(50)).min(1).max(10),
});

// --- Part 3: Property Moderation ---

const propertyStatusEnum = z.enum([
  "draft",
  "pending_review",
  "published",
  "rented",
  "inactive",
  "removed",
  "rejected",
]);

export const adminSearchPropertiesQuerySchema = z.object({
  status: propertyStatusEnum.optional(),
  categoryId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  isFeatured: booleanQueryParam,
  city: z.string().max(120).optional(),
  sort: z.enum(["newest", "oldest", "most_viewed", "most_favorited"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const rejectPropertySchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const hidePropertySchema = z.object({
  reason: z.string().max(1000).optional(),
});

export const bulkModeratePropertiesSchema = z.object({
  propertyIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["approve", "reject", "hide", "unhide", "feature", "unfeature", "delete"]),
  reason: z.string().max(1000).optional(),
});

export const moderationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Part 4: Report Management ---

const propertyReportStatusEnum = z.enum(["pending", "reviewed", "dismissed", "action_taken"]);
const userReportStatusEnum = z.enum(["pending", "reviewed", "dismissed", "action_taken"]);

export const listReportsQuerySchema = z.object({
  status: propertyReportStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updatePropertyReportStatusSchema = z.object({
  status: propertyReportStatusEnum,
});

export const updateUserReportStatusSchema = z.object({
  status: userReportStatusEnum,
});

export const reportUserSchema = z.object({
  reason: z.enum(["spam", "harassment", "fraud", "fake_profile", "inappropriate_behavior", "other"]),
  details: z.string().max(1000).optional(),
});

// --- Part 5: Owner Verification ---

export const submitVerificationSchema = z.object({
  documentType: z.enum(["government_id", "passport", "driving_license", "other"]),
});

export const rejectVerificationSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const listVerificationsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Part 6: Notifications ---

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  audience: z
    .object({
      role: z.string().max(50).optional(),
      status: userStatusEnum.optional(),
    })
    .default({}),
});

// --- Part 7: Analytics ---

export const growthAnalyticsQuerySchema = z.object({
  metric: z.enum(["users", "properties", "views", "favorites", "reports"]),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const topPropertiesQuerySchema = z.object({
  metric: z.enum(["most_viewed", "most_favorited"]),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// --- Part 8: Audit Logs ---

export const searchAuditLogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  entityType: z.string().max(100).optional(),
  entityId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  format: z.enum(["json", "csv"]).default("json"),
});
