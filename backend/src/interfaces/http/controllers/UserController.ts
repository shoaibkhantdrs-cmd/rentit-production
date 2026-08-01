import { Request, Response } from "express";
import { z } from "zod";
import { GetMeUseCase } from "@/application/users/GetMe.usecase";
import { UpdateMeUseCase } from "@/application/users/UpdateMe.usecase";
import { DeleteMeUseCase } from "@/application/users/DeleteMe.usecase";
import { ReportUserUseCase } from "@/application/users/ReportUser.usecase";
import { RequestPhoneOtpUseCase } from "@/application/users/RequestPhoneOtp.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import { updateMeSchema } from "@/interfaces/http/validators/user.schemas";
import { reportUserSchema } from "@/interfaces/http/validators/admin.schemas";

export class UserController {
  constructor(
    private readonly getMe: GetMeUseCase,
    private readonly updateMe: UpdateMeUseCase,
    private readonly deleteMe: DeleteMeUseCase,
    private readonly reportUser: ReportUserUseCase,
    private readonly requestPhoneOtp: RequestPhoneOtpUseCase,
  ) {}

  getMeHandler = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.getMe.execute(req.user.sub);
    res.status(200).json(result);
  };

  updateMeHandler = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updateMeSchema>;
    const result = await this.updateMe.execute({ userId: req.user.sub, ...body });
    res.status(200).json(result);
  };

  deleteMeHandler = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.deleteMe.execute(req.user.sub);
    res.status(204).send();
  };

  report = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof reportUserSchema>;
    await this.reportUser.execute({
      reportedUserId: req.params.id,
      reporterUserId: req.user.sub,
      reason: body.reason,
      details: body.details,
    });
    res.status(201).json({ message: "Report submitted. Thank you for helping keep RentIt safe." });
  };

  /** "Verify Phone" button on Profile -- resends a phone_verification OTP
   * for the phone already on file, without requiring the number to change
   * (see RequestPhoneOtpUseCase's doc comment). */
  requestPhoneOtpHandler = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const { devOtp } = await this.requestPhoneOtp.execute({ userId: req.user.sub });
    // devOtp is only ever set outside production (see OtpIssuer's
    // isDevSmsBypass) -- no real SMS provider is called in that case, so the
    // code is returned here instead of being delivered.
    if (devOtp) {
      res.status(200).json({ message: "OTP generated (development mode)", otp: devOtp });
    } else {
      res.status(200).json({ message: "Verification code sent to your phone." });
    }
  };
}
