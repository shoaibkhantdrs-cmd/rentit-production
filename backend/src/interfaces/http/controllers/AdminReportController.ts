import { Request, Response } from "express";
import { z } from "zod";
import { ListPropertyReportsUseCase } from "@/application/admin/reports/ListPropertyReports.usecase";
import { UpdatePropertyReportStatusUseCase } from "@/application/admin/reports/UpdatePropertyReportStatus.usecase";
import { ListUserReportsUseCase } from "@/application/admin/reports/ListUserReports.usecase";
import { UpdateUserReportStatusUseCase } from "@/application/admin/reports/UpdateUserReportStatus.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  listReportsQuerySchema,
  updatePropertyReportStatusSchema,
  updateUserReportStatusSchema,
} from "@/interfaces/http/validators/admin.schemas";

/** Admin Report Management (Phase 4 Part 4) -- reported properties and
 * reported users. "Resolve" = status "reviewed"/"action_taken", "Dismiss" =
 * status "dismissed"; both funnel through the same update-status endpoint
 * with a different body value rather than four separate routes. */
export class AdminReportController {
  constructor(
    private readonly listPropertyReports: ListPropertyReportsUseCase,
    private readonly updatePropertyReportStatus: UpdatePropertyReportStatusUseCase,
    private readonly listUserReports: ListUserReportsUseCase,
    private readonly updateUserReportStatus: UpdateUserReportStatusUseCase,
  ) {}

  listProperties = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof listReportsQuerySchema>;
    const result = await this.listPropertyReports.execute(query);
    res.status(200).json(result);
  };

  updatePropertyStatus = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updatePropertyReportStatusSchema>;
    const result = await this.updatePropertyReportStatus.execute({
      reportId: req.params.id,
      status: body.status,
      actorId: req.user.sub,
    });
    res.status(200).json(result);
  };

  listUsers = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof listReportsQuerySchema>;
    const result = await this.listUserReports.execute(query);
    res.status(200).json(result);
  };

  updateUserStatus = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updateUserReportStatusSchema>;
    const result = await this.updateUserReportStatus.execute({
      reportId: req.params.id,
      status: body.status,
      actorId: req.user.sub,
    });
    res.status(200).json(result);
  };
}
