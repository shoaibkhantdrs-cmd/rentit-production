import { httpClient } from "./httpClient";
import { env } from "@/config/env";
import { tokenStore } from "./tokenStore";
import {
  AdminDashboardStats,
  AdminProperty,
  AdminPropertySearchFilters,
  AdminUserProfile,
  AdminUserSummary,
  AuditLogRecord,
  BulkModerationAction,
  BulkModerationResultItem,
  GrowthAnalyticsResult,
  GrowthMetric,
  IdentityVerificationRecord,
  IdentityVerificationStatus,
  PaginatedResult,
  PropertyAnalyticsRow,
  PropertyReportRecord,
  PropertyStatusHistoryRecord,
  ReportStatus,
  SystemHealthReport,
  TopPropertiesMetric,
  UserReportRecord,
  UserStatus,
} from "./types";

/** All calls here hit /admin/* routes, which the backend gates behind
 * authenticate + authorize("admin","super_admin") -- see
 * backend/src/interfaces/http/routes/admin.routes.ts. */
export const adminApi = {
  // --- Part 1: Dashboard + System Health ---
  dashboardStats: () => httpClient.get<AdminDashboardStats>("/admin/dashboard/stats"),
  systemHealth: () => httpClient.get<SystemHealthReport>("/admin/system/health"),

  // --- Part 7: Analytics ---
  growth: (metric: GrowthMetric, days: number) =>
    httpClient.get<GrowthAnalyticsResult>("/admin/analytics/growth", { metric, days }),
  topProperties: (metric: TopPropertiesMetric, limit: number) =>
    httpClient.get<{ metric: TopPropertiesMetric; items: PropertyAnalyticsRow[] }>(
      "/admin/analytics/top-properties",
      { metric, limit },
    ),

  // --- Part 2: User Management ---
  searchUsers: (params: { query?: string; status?: UserStatus; role?: string; page: number; pageSize: number }) =>
    httpClient.get<PaginatedResult<AdminUserSummary>>("/admin/users", params),
  getUserProfile: (userId: string) => httpClient.get<AdminUserProfile>(`/admin/users/${userId}`),
  getUserActivity: (userId: string, page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<{ id: string; action: string; createdAt: string }>>(
      `/admin/users/${userId}/activity`,
      { page, pageSize },
    ),
  updateUserStatus: (userId: string, status: UserStatus, reason?: string) =>
    httpClient.patch<AdminUserSummary>(`/admin/users/${userId}/status`, { status, reason }),
  deleteUser: (userId: string) => httpClient.delete<void>(`/admin/users/${userId}`),
  resetUserPassword: (userId: string) =>
    httpClient.post<{ message: string }>(`/admin/users/${userId}/reset-password`),
  // RC1 bug fix: this was a PATCH, but the backend only accepts PUT for
  // this route (admin.routes.ts: router.put("/users/:id/roles", ...)) --
  // every call to this method was failing (404/405) before this fix.
  updateUserRoles: (userId: string, roleNames: string[]) =>
    httpClient.put<AdminUserSummary>(`/admin/users/${userId}/roles`, { roleNames }),

  // --- Part 3: Property Moderation ---
  searchProperties: (filters: AdminPropertySearchFilters) =>
    // Spread into a fresh object literal (not just `filters` as-is) --
    // passing a named-interface-typed variable directly to a
    // Record<string, ...>-typed parameter fails TypeScript's structural
    // index-signature check even though every property here already has
    // a compatible value type; a fresh object literal doesn't have that
    // restriction. Found via a real `tsc --noEmit` run (Part 9 QA), fixed
    // here rather than by loosening AdminPropertySearchFilters itself
    // (which is also used for component state typing elsewhere) or
    // httpClient's query type (used by every other API call).
    httpClient.get<PaginatedResult<AdminProperty>>("/admin/properties", { ...filters }),
  approveProperty: (propertyId: string) => httpClient.post<AdminProperty>(`/admin/properties/${propertyId}/approve`),
  rejectProperty: (propertyId: string, reason: string) =>
    httpClient.post<AdminProperty>(`/admin/properties/${propertyId}/reject`, { reason }),
  hideProperty: (propertyId: string, reason?: string) =>
    httpClient.post<AdminProperty>(`/admin/properties/${propertyId}/hide`, { reason }),
  unhideProperty: (propertyId: string) => httpClient.post<AdminProperty>(`/admin/properties/${propertyId}/unhide`),
  featureProperty: (propertyId: string) => httpClient.post<AdminProperty>(`/admin/properties/${propertyId}/feature`),
  unfeatureProperty: (propertyId: string) =>
    httpClient.post<AdminProperty>(`/admin/properties/${propertyId}/unfeature`),
  bulkModerate: (propertyIds: string[], action: BulkModerationAction, reason?: string) =>
    httpClient.post<{ results: BulkModerationResultItem[] }>("/admin/properties/bulk-moderate", {
      propertyIds,
      action,
      reason,
    }),
  propertyModerationHistory: (propertyId: string, page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<PropertyStatusHistoryRecord>>(
      `/admin/properties/${propertyId}/moderation-history`,
      { page, pageSize },
    ),
  recentModerationActivity: (page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<PropertyStatusHistoryRecord>>("/admin/properties/moderation-history", {
      page,
      pageSize,
    }),

  // --- Part 4: Report Management ---
  listPropertyReports: (status: ReportStatus | undefined, page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<PropertyReportRecord>>("/admin/reports/properties", { status, page, pageSize }),
  updatePropertyReportStatus: (reportId: string, status: ReportStatus) =>
    httpClient.patch<PropertyReportRecord>(`/admin/reports/properties/${reportId}/status`, { status }),
  listUserReports: (status: ReportStatus | undefined, page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<UserReportRecord>>("/admin/reports/users", { status, page, pageSize }),
  updateUserReportStatus: (reportId: string, status: ReportStatus) =>
    httpClient.patch<UserReportRecord>(`/admin/reports/users/${reportId}/status`, { status }),

  // --- Part 5: Owner Verification (admin review) ---
  listVerifications: (status: IdentityVerificationStatus | undefined, page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<IdentityVerificationRecord>>("/admin/verification", { status, page, pageSize }),
  approveVerification: (verificationId: string) =>
    httpClient.post<IdentityVerificationRecord>(`/admin/verification/${verificationId}/approve`),
  rejectVerification: (verificationId: string, reason: string) =>
    httpClient.post<IdentityVerificationRecord>(`/admin/verification/${verificationId}/reject`, { reason }),

  // --- Part 6: Notifications ---
  broadcastNotification: (input: { title: string; body: string; audience: { role?: string; status?: UserStatus } }) =>
    httpClient.post<{ recipientCount: number }>("/admin/notifications/broadcast", input),

  // --- Part 8: Audit Logs ---
  searchAuditLogs: (params: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    page: number;
    pageSize: number;
  }) => httpClient.get<PaginatedResult<AuditLogRecord>>("/admin/audit-logs", params),

  /**
   * CSV export re-hits the same endpoint with ?format=csv. This can't be a
   * plain `<a href>` download: the route requires a Bearer token, and a
   * browser navigation can't attach one. Instead this fetches the CSV as a
   * Blob (with the auth header, exactly like every other admin call) and
   * triggers the download client-side via a throwaway object URL.
   */
  downloadAuditLogsCsv: async (params: Record<string, string | number | undefined>): Promise<void> => {
    const search = new URLSearchParams();
    search.set("format", "csv");
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }

    const stored = tokenStore.get();
    const headers: Record<string, string> = {};
    if (stored) headers.Authorization = `Bearer ${stored.tokens.accessToken}`;

    const url = new URL("/admin/audit-logs", env.apiBaseUrl);
    url.search = search.toString();

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      throw new Error(`Export failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "audit-logs.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
};
