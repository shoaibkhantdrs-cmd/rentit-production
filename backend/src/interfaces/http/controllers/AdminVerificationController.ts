import { Request, Response } from "express";
import { z } from "zod";
import { ListIdentityVerificationsUseCase } from "@/application/admin/verification/ListIdentityVerifications.usecase";
import { ApproveIdentityVerificationUseCase } from "@/application/admin/verification/ApproveIdentityVerification.usecase";
import { RejectIdentityVerificationUseCase } from "@/application/admin/verification/RejectIdentityVerification.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import { listVerificationsQuerySchema, rejectVerificationSchema } from "@/interfaces/http/validators/admin.schemas";

/** Owner Verification (Phase 4 Part 5), admin half: review submitted
 * identity documents. */
export class AdminVerificationController {
  constructor(
    private readonly listIdentityVerifications: ListIdentityVerificationsUseCase,
    private readonly approveIdentityVerification: ApproveIdentityVerificationUseCase,
    private readonly rejectIdentityVerification: RejectIdentityVerificationUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof listVerificationsQuerySchema>;
    const result = await this.listIdentityVerifications.execute(query);
    res.status(200).json(result);
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.approveIdentityVerification.execute({
      verificationId: req.params.id,
      actorId: req.user.sub,
    });
    res.status(200).json(result);
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof rejectVerificationSchema>;
    const result = await this.rejectIdentityVerification.execute({
      verificationId: req.params.id,
      actorId: req.user.sub,
      reason: body.reason,
    });
    res.status(200).json(result);
  };
}
