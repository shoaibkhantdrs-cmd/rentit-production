import { RequestHandler, Router } from "express";
import { AdminUserController } from "@/interfaces/http/controllers/AdminUserController";
import { AdminPropertyController } from "@/interfaces/http/controllers/AdminPropertyController";
import { AdminReportController } from "@/interfaces/http/controllers/AdminReportController";
import { AdminVerificationController } from "@/interfaces/http/controllers/AdminVerificationController";
import { AdminNotificationController } from "@/interfaces/http/controllers/AdminNotificationController";
import { AdminDashboardController } from "@/interfaces/http/controllers/AdminDashboardController";
import { AdminAuditController } from "@/interfaces/http/controllers/AdminAuditController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import { authorize } from "@/interfaces/http/middleware/authorize";
import {
  adminSearchPropertiesQuerySchema,
  broadcastNotificationSchema,
  bulkModeratePropertiesSchema,
  growthAnalyticsQuerySchema,
  hidePropertySchema,
  idParamSchema,
  listReportsQuerySchema,
  listVerificationsQuerySchema,
  moderationHistoryQuerySchema,
  rejectPropertySchema,
  rejectVerificationSchema,
  searchAuditLogsQuerySchema,
  searchUsersQuerySchema,
  topPropertiesQuerySchema,
  updatePropertyReportStatusSchema,
  updateUserReportStatusSchema,
  updateUserRolesSchema,
  updateUserStatusSchema,
  paginationQuerySchema,
} from "@/interfaces/http/validators/admin.schemas";

export interface AdminRouterDeps {
  adminUserController: AdminUserController;
  adminPropertyController: AdminPropertyController;
  adminReportController: AdminReportController;
  adminVerificationController: AdminVerificationController;
  adminNotificationController: AdminNotificationController;
  adminDashboardController: AdminDashboardController;
  adminAuditController: AdminAuditController;
}

/**
 * Every route under /admin is gated by authenticate + authorize("admin",
 * "super_admin") -- applied once at the router level here rather than on
 * each individual route, so a future admin endpoint can't accidentally be
 * added without the gate.
 */
export function createAdminRouter(deps: AdminRouterDeps, authenticate: RequestHandler): Router {
  const router = Router();

  router.use(authenticate, authorize("admin", "super_admin"));

  // --- Part 1: Dashboard + System Health ---
  router.get("/dashboard/stats", asyncHandler(deps.adminDashboardController.stats));
  router.get("/system/health", asyncHandler(deps.adminDashboardController.systemHealth));

  // --- Part 7: Analytics ---
  router.get(
    "/analytics/growth",
    validate(growthAnalyticsQuerySchema, "query"),
    asyncHandler(deps.adminDashboardController.growth),
  );
  router.get(
    "/analytics/top-properties",
    validate(topPropertiesQuerySchema, "query"),
    asyncHandler(deps.adminDashboardController.topProperties),
  );

  // --- Part 2: User Management ---
  router.get(
    "/users",
    validate(searchUsersQuerySchema, "query"),
    asyncHandler(deps.adminUserController.search),
  );
  router.get(
    "/users/:id",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminUserController.getProfile),
  );
  router.get(
    "/users/:id/activity",
    validate(idParamSchema, "params"),
    validate(paginationQuerySchema, "query"),
    asyncHandler(deps.adminUserController.activity),
  );
  router.patch(
    "/users/:id/status",
    validate(idParamSchema, "params"),
    validate(updateUserStatusSchema),
    asyncHandler(deps.adminUserController.updateStatus),
  );
  router.delete(
    "/users/:id",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminUserController.remove),
  );
  router.post(
    "/users/:id/reset-password",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminUserController.resetPassword),
  );
  router.put(
    "/users/:id/roles",
    validate(idParamSchema, "params"),
    validate(updateUserRolesSchema),
    asyncHandler(deps.adminUserController.updateRoles),
  );

  // --- Part 3: Property Moderation ---
  // Pending/Approved/Rejected/Hidden/Featured lists are all this same
  // search endpoint with a different `status`/`isFeatured` query filter.
  router.get(
    "/properties",
    validate(adminSearchPropertiesQuerySchema, "query"),
    asyncHandler(deps.adminPropertyController.search),
  );
  router.get(
    "/properties/moderation-history",
    validate(moderationHistoryQuerySchema, "query"),
    asyncHandler(deps.adminPropertyController.recentModerationActivity),
  );
  router.post(
    "/properties/bulk-moderate",
    validate(bulkModeratePropertiesSchema),
    asyncHandler(deps.adminPropertyController.bulkModerate),
  );
  router.get(
    "/properties/:id/moderation-history",
    validate(idParamSchema, "params"),
    validate(moderationHistoryQuerySchema, "query"),
    asyncHandler(deps.adminPropertyController.moderationHistory),
  );
  router.post(
    "/properties/:id/approve",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminPropertyController.approve),
  );
  router.post(
    "/properties/:id/reject",
    validate(idParamSchema, "params"),
    validate(rejectPropertySchema),
    asyncHandler(deps.adminPropertyController.reject),
  );
  router.post(
    "/properties/:id/hide",
    validate(idParamSchema, "params"),
    validate(hidePropertySchema),
    asyncHandler(deps.adminPropertyController.hide),
  );
  router.post(
    "/properties/:id/unhide",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminPropertyController.unhide),
  );
  router.post(
    "/properties/:id/feature",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminPropertyController.feature),
  );
  router.post(
    "/properties/:id/unfeature",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminPropertyController.unfeature),
  );

  // --- Part 4: Report Management ---
  router.get(
    "/reports/properties",
    validate(listReportsQuerySchema, "query"),
    asyncHandler(deps.adminReportController.listProperties),
  );
  router.patch(
    "/reports/properties/:id/status",
    validate(idParamSchema, "params"),
    validate(updatePropertyReportStatusSchema),
    asyncHandler(deps.adminReportController.updatePropertyStatus),
  );
  router.get(
    "/reports/users",
    validate(listReportsQuerySchema, "query"),
    asyncHandler(deps.adminReportController.listUsers),
  );
  router.patch(
    "/reports/users/:id/status",
    validate(idParamSchema, "params"),
    validate(updateUserReportStatusSchema),
    asyncHandler(deps.adminReportController.updateUserStatus),
  );

  // --- Part 5: Owner Verification (admin review) ---
  router.get(
    "/verification",
    validate(listVerificationsQuerySchema, "query"),
    asyncHandler(deps.adminVerificationController.list),
  );
  router.post(
    "/verification/:id/approve",
    validate(idParamSchema, "params"),
    asyncHandler(deps.adminVerificationController.approve),
  );
  router.post(
    "/verification/:id/reject",
    validate(idParamSchema, "params"),
    validate(rejectVerificationSchema),
    asyncHandler(deps.adminVerificationController.reject),
  );

  // --- Part 6: Notifications ---
  router.post(
    "/notifications/broadcast",
    validate(broadcastNotificationSchema),
    asyncHandler(deps.adminNotificationController.broadcast),
  );

  // --- Part 8: Audit Logs (search + CSV export via ?format=csv) ---
  router.get(
    "/audit-logs",
    validate(searchAuditLogsQuerySchema, "query"),
    asyncHandler(deps.adminAuditController.search),
  );

  return router;
}
