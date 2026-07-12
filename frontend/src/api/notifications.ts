import { httpClient } from "./httpClient";
import { AppNotification, NotificationPreferences, PaginatedResult } from "./types";

export const notificationsApi = {
  list: (page = 1, pageSize = 20, unreadOnly = false) =>
    httpClient.get<PaginatedResult<AppNotification>>("/notifications", { page, pageSize, unreadOnly }),

  markRead: (ids?: string[]) => httpClient.patch<{ updated: number }>("/notifications/read", { ids }),

  registerDeviceToken: (pushToken: string | null) =>
    httpClient.post<void>("/notifications/device-token", { pushToken }),

  getPreferences: () => httpClient.get<NotificationPreferences>("/notifications/preferences"),

  updatePreferences: (patch: Partial<NotificationPreferences>) =>
    httpClient.patch<NotificationPreferences>("/notifications/preferences", patch),
};
