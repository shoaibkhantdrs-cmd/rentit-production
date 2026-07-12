import { Request, Response } from "express";
import { z } from "zod";
import { BroadcastNotificationUseCase } from "@/application/admin/notifications/BroadcastNotification.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import { broadcastNotificationSchema } from "@/interfaces/http/validators/admin.schemas";

/** Admin Notifications (Phase 4 Part 6). Admins reuse the existing
 * GET/PATCH /notifications endpoints (Phase 2) to read their own
 * "system notifications" (e.g. new report filed) -- this controller only
 * adds the admin-only broadcast action. */
export class AdminNotificationController {
  constructor(private readonly broadcastNotification: BroadcastNotificationUseCase) {}

  broadcast = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof broadcastNotificationSchema>;
    const result = await this.broadcastNotification.execute({
      title: body.title,
      body: body.body,
      audience: body.audience,
      actorId: req.user.sub,
    });
    res.status(202).json(result);
  };
}
