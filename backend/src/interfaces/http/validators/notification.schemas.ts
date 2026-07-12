import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

// --- Phase 5 additions ---

export const registerPushTokenSchema = z.object({
  pushToken: z.string().min(1).max(4096).nullable(),
});

const notificationCategoriesSchema = z
  .object({
    newProperties: z.boolean().optional(),
    newMessages: z.boolean().optional(),
    favoriteUpdates: z.boolean().optional(),
    adminAnnouncements: z.boolean().optional(),
  })
  .optional();

export const updateNotificationPreferencesSchema = z.object({
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  categories: notificationCategoriesSchema,
});
