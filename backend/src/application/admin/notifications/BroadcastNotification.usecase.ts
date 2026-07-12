import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IPushNotificationService } from "@/domain/services/IPushNotificationService";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { ValidationError } from "@/domain/errors/AppError";
import { User } from "@/domain/entities/User";

export interface BroadcastNotificationInput {
  title: string;
  body: string;
  /** Send to every active user, or scope to a single role (e.g. "property_owner"). */
  audience: { role?: string; status?: User["status"] };
  actorId: string;
}

const PAGE_SIZE = 500;
const MAX_RECIPIENTS = 5000; // safety cap for a single broadcast in this phase

/**
 * "Broadcast Notifications" (Part 6): creates one in-app Notification row
 * per targeted user (reusing Phase 2's `notifications` table -- no new
 * table needed) and attempts a push notification via
 * IPushNotificationService (Part 6's "Push Notification Service
 * Interface" -- console-logged in this phase, see
 * ConsolePushNotificationService).
 */
export class BroadcastNotificationUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly pushService: IPushNotificationService,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: BroadcastNotificationInput): Promise<{ recipientCount: number }> {
    if (!input.title.trim() || !input.body.trim()) {
      throw new ValidationError("Broadcast title and body are required");
    }

    const recipientIds: string[] = [];
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await this.userRepo.search(
        { status: input.audience.status ?? "active", role: input.audience.role },
        page,
        PAGE_SIZE,
      );
      recipientIds.push(...result.items.map((item) => item.user.id));

      if (recipientIds.length >= result.total || recipientIds.length >= MAX_RECIPIENTS || result.items.length === 0) {
        break;
      }
      page += 1;
    }

    const capped = recipientIds.slice(0, MAX_RECIPIENTS);

    for (const userId of capped) {
      await this.notificationRepo.create({
        userId,
        type: "admin.broadcast",
        title: input.title.trim(),
        body: input.body.trim(),
      });
    }

    await this.pushService.sendBulk(
      capped.map((userId) => ({ userId, title: input.title.trim(), body: input.body.trim() })),
    );

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.notification.broadcast",
      metadata: { recipientCount: capped.length, audience: input.audience },
    });

    return { recipientCount: capped.length };
  }
}
