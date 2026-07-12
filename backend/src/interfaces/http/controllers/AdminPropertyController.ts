import { Request, Response } from "express";
import { z } from "zod";
import { AdminSearchPropertiesUseCase } from "@/application/admin/properties/AdminSearchProperties.usecase";
import { ApprovePropertyUseCase } from "@/application/admin/properties/ApproveProperty.usecase";
import { RejectPropertyUseCase } from "@/application/admin/properties/RejectProperty.usecase";
import { HidePropertyUseCase } from "@/application/admin/properties/HideProperty.usecase";
import { UnhidePropertyUseCase } from "@/application/admin/properties/UnhideProperty.usecase";
import { FeaturePropertyUseCase } from "@/application/admin/properties/FeatureProperty.usecase";
import { UnfeaturePropertyUseCase } from "@/application/admin/properties/UnfeatureProperty.usecase";
import { BulkModeratePropertiesUseCase } from "@/application/admin/properties/BulkModerateProperties.usecase";
import { GetPropertyModerationHistoryUseCase } from "@/application/admin/properties/GetPropertyModerationHistory.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  adminSearchPropertiesQuerySchema,
  bulkModeratePropertiesSchema,
  hidePropertySchema,
  moderationHistoryQuerySchema,
  rejectPropertySchema,
} from "@/interfaces/http/validators/admin.schemas";

/** Admin Property Moderation (Phase 4 Part 3). */
export class AdminPropertyController {
  constructor(
    private readonly adminSearchProperties: AdminSearchPropertiesUseCase,
    private readonly approveProperty: ApprovePropertyUseCase,
    private readonly rejectProperty: RejectPropertyUseCase,
    private readonly hideProperty: HidePropertyUseCase,
    private readonly unhideProperty: UnhidePropertyUseCase,
    private readonly featureProperty: FeaturePropertyUseCase,
    private readonly unfeatureProperty: UnfeaturePropertyUseCase,
    private readonly bulkModerateProperties: BulkModeratePropertiesUseCase,
    private readonly getModerationHistory: GetPropertyModerationHistoryUseCase,
  ) {}

  search = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof adminSearchPropertiesQuerySchema>;
    const result = await this.adminSearchProperties.execute(query);
    res.status(200).json(result);
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.approveProperty.execute({ propertyId: req.params.id, actorId: req.user.sub });
    res.status(200).json(result);
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof rejectPropertySchema>;
    const result = await this.rejectProperty.execute({
      propertyId: req.params.id,
      actorId: req.user.sub,
      reason: body.reason,
    });
    res.status(200).json(result);
  };

  hide = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof hidePropertySchema>;
    const result = await this.hideProperty.execute({
      propertyId: req.params.id,
      actorId: req.user.sub,
      reason: body.reason,
    });
    res.status(200).json(result);
  };

  unhide = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.unhideProperty.execute({ propertyId: req.params.id, actorId: req.user.sub });
    res.status(200).json(result);
  };

  feature = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.featureProperty.execute({ propertyId: req.params.id, actorId: req.user.sub });
    res.status(200).json(result);
  };

  unfeature = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.unfeatureProperty.execute({ propertyId: req.params.id, actorId: req.user.sub });
    res.status(200).json(result);
  };

  bulkModerate = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof bulkModeratePropertiesSchema>;
    const result = await this.bulkModerateProperties.execute({
      propertyIds: body.propertyIds,
      action: body.action,
      reason: body.reason,
      actorId: req.user.sub,
      actorRoles: req.user.roles,
    });
    res.status(200).json(result);
  };

  moderationHistory = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof moderationHistoryQuerySchema>;
    const result = await this.getModerationHistory.execute({
      propertyId: req.params.id,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };

  recentModerationActivity = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof moderationHistoryQuerySchema>;
    const result = await this.getModerationHistory.execute({ page: query.page, pageSize: query.pageSize });
    res.status(200).json(result);
  };
}
