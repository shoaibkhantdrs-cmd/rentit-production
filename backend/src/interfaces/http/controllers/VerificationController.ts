import { Request, Response } from "express";
import { z } from "zod";
import { SubmitIdentityVerificationUseCase } from "@/application/verification/SubmitIdentityVerification.usecase";
import { GetMyVerificationStatusUseCase } from "@/application/verification/GetMyVerificationStatus.usecase";
import { UnauthorizedError, ValidationError } from "@/domain/errors/AppError";
import { submitVerificationSchema } from "@/interfaces/http/validators/admin.schemas";

/** Owner Verification (Phase 4 Part 5), self-service half: submit an
 * identity document and check status. Phone/email verification already
 * exist from Phase 2 (OTP flows) -- "Verification Status" here surfaces
 * all three together. */
export class VerificationController {
  constructor(
    private readonly submitIdentityVerification: SubmitIdentityVerificationUseCase,
    private readonly getMyVerificationStatus: GetMyVerificationStatusUseCase,
  ) {}

  submit = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof submitVerificationSchema>;
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      throw new ValidationError("Attach a document image under the 'document' field");
    }
    const result = await this.submitIdentityVerification.execute({
      userId: req.user.sub,
      documentType: body.documentType,
      file: { buffer: file.buffer },
    });
    res.status(201).json(result);
  };

  status = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.getMyVerificationStatus.execute(req.user.sub);
    res.status(200).json(result);
  };
}
