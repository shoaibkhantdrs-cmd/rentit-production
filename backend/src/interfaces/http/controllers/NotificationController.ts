import { Request, Response } from "express";
import { z } from "zod";
import { ListNotificationsUseCase } from "@/application/notifications/ListNotifications.usecase";
import { MarkNotificationsReadUseCase } from "@/application/notifications/MarkNotificationsRead.usecase";
import { RegisterPushTokenUseCase } from "@/application/notifications/RegisterPushToken.usecase";
import {
  GetNotificationPreferencesUseCase,
  UpdateNotificationPreferencesUseCase,
} from "@/application/notifications/NotificationPreferences";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  listNotificationsQuerySchema,
  markNotificationsReadSchema,
  registerPushTokenSchema,
  updateNotificationPreferencesSchema,
} from "@/interfaces/http/validators/notification.schemas";

export class NotificationController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markNotificationsRead: MarkNotificationsReadUseCase,
    private readonly registerPushToken: RegisterPushTokenUseCase,
    private readonly getNotificationPreferences: GetNotificationPreferencesUseCase,
    private readonly updateNotificationPreferences: UpdateNotificationPreferencesUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof listNotificationsQuerySchema>;
    const result = await this.listNotifications.execute({ userId: req.user.sub, ...query });
    res.status(200).json(result);
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof markNotificationsReadSchema>;
    const result = await this.markNotificationsRead.execute({ userId: req.user.sub, ...body });
    res.status(200).json(result);
  };

  registerDeviceToken = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof registerPushTokenSchema>;
    await this.registerPushToken.execute({
      userId: req.user.sub,
      deviceId: req.deviceContext.deviceId,
      platform: req.deviceContext.platform,
      userAgent: req.deviceContext.userAgent,
      pushToken: body.pushToken,
    });
    res.status(204).send();
  };

  getPreferences = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.getNotificationPreferences.execute(req.user.sub);
    res.status(200).json(result);
  };

  updatePreferences = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updateNotificationPreferencesSchema>;
    const result = await this.updateNotificationPreferences.execute({ userId: req.user.sub, ...body });
    res.status(200).json(result);
  };
}
