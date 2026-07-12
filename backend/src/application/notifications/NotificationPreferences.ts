import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";

/** The category-level toggles from Phase 5 Part 2 ("Notification
 * preferences"). Channel-level toggles (notifyEmail/notifySms/notifyPush)
 * already existed on UserPreference since Phase 2; these categories live
 * inside its `extra` JSONB catch-all rather than as new columns, so no
 * migration was needed for this. */
export interface NotificationCategoryPreferences {
  newProperties: boolean;
  newMessages: boolean;
  favoriteUpdates: boolean;
  adminAnnouncements: boolean;
}

export const DEFAULT_CATEGORY_PREFERENCES: NotificationCategoryPreferences = {
  newProperties: true,
  newMessages: true,
  favoriteUpdates: true,
  adminAnnouncements: true,
};

export interface NotificationPreferencesDto {
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  categories: NotificationCategoryPreferences;
}

function readCategories(extra: Record<string, unknown>): NotificationCategoryPreferences {
  const raw = extra.notificationCategories;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CATEGORY_PREFERENCES };
  return { ...DEFAULT_CATEGORY_PREFERENCES, ...(raw as Partial<NotificationCategoryPreferences>) };
}

export class GetNotificationPreferencesUseCase {
  constructor(private readonly userPreferenceRepo: IUserPreferenceRepository) {}

  async execute(userId: string): Promise<NotificationPreferencesDto> {
    let preferences = await this.userPreferenceRepo.findByUserId(userId);
    if (!preferences) {
      preferences = await this.userPreferenceRepo.createDefault(userId);
    }
    return {
      notifyEmail: preferences.notifyEmail,
      notifySms: preferences.notifySms,
      notifyPush: preferences.notifyPush,
      categories: readCategories(preferences.extra),
    };
  }
}

export interface UpdateNotificationPreferencesInput {
  userId: string;
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifyPush?: boolean;
  categories?: Partial<NotificationCategoryPreferences>;
}

export class UpdateNotificationPreferencesUseCase {
  constructor(private readonly userPreferenceRepo: IUserPreferenceRepository) {}

  async execute(input: UpdateNotificationPreferencesInput): Promise<NotificationPreferencesDto> {
    let preferences = await this.userPreferenceRepo.findByUserId(input.userId);
    if (!preferences) {
      preferences = await this.userPreferenceRepo.createDefault(input.userId);
    }

    const mergedCategories: NotificationCategoryPreferences = {
      ...readCategories(preferences.extra),
      ...input.categories,
    };

    const updated = await this.userPreferenceRepo.update(input.userId, {
      notifyEmail: input.notifyEmail ?? preferences.notifyEmail,
      notifySms: input.notifySms ?? preferences.notifySms,
      notifyPush: input.notifyPush ?? preferences.notifyPush,
      extra: { ...preferences.extra, notificationCategories: mergedCategories },
    });

    return {
      notifyEmail: updated.notifyEmail,
      notifySms: updated.notifySms,
      notifyPush: updated.notifyPush,
      categories: readCategories(updated.extra),
    };
  }
}

/** Whether a given category is currently enabled for a user -- the check
 * every notification-sending use-case (new property alerts, favorite
 * updates, broadcasts) should make before actually sending. Returns true
 * (fail open) if preferences don't exist yet, matching the "on by
 * default" defaults above. */
export async function isCategoryEnabled(
  userPreferenceRepo: IUserPreferenceRepository,
  userId: string,
  category: keyof NotificationCategoryPreferences,
): Promise<boolean> {
  const preferences = await userPreferenceRepo.findByUserId(userId);
  if (!preferences) return true;
  return readCategories(preferences.extra)[category];
}
