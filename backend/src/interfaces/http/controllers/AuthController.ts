import { Request, Response } from "express";
import { z } from "zod";
import { RegisterUserUseCase } from "@/application/auth/RegisterUser.usecase";
import { LoginUserUseCase } from "@/application/auth/LoginUser.usecase";
import { VerifyOtpUseCase } from "@/application/auth/VerifyOtp.usecase";
import { RefreshTokenUseCase } from "@/application/auth/RefreshToken.usecase";
import { LogoutUserUseCase } from "@/application/auth/LogoutUser.usecase";
import { LogoutAllDevicesUseCase } from "@/application/auth/LogoutAllDevices.usecase";
import { ForgotPasswordUseCase } from "@/application/auth/ForgotPassword.usecase";
import { ResetPasswordUseCase } from "@/application/auth/ResetPassword.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/interfaces/http/validators/auth.schemas";

export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly verifyOtp: VerifyOtpUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logoutUser: LogoutUserUseCase,
    private readonly logoutAllDevices: LogoutAllDevicesUseCase,
    private readonly forgotPassword: ForgotPasswordUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof registerSchema>;
    const result = await this.registerUser.execute({ ...body, device: req.deviceContext });
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof loginSchema>;
    const result = await this.loginUser.execute({ ...body, device: req.deviceContext });
    res.status(200).json(result);
  };

  verifyOtpHandler = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof verifyOtpSchema>;
    const result = await this.verifyOtp.execute({ ...body, device: req.deviceContext });
    res.status(200).json(result);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof refreshSchema>;
    const result = await this.refreshToken.execute({
      refreshToken: body.refreshToken,
      ipAddress: req.deviceContext.ipAddress,
      userAgent: req.deviceContext.userAgent,
    });
    res.status(200).json(result);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof logoutSchema>;
    await this.logoutUser.execute({ refreshToken: body.refreshToken });
    res.status(204).send();
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.logoutAllDevices.execute({ userId: req.user.sub });
    res.status(200).json(result);
  };

  forgotPasswordHandler = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof forgotPasswordSchema>;
    await this.forgotPassword.execute(body);
    res
      .status(200)
      .json({ message: "If that email is registered, a reset code has been sent." });
  };

  resetPasswordHandler = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof resetPasswordSchema>;
    await this.resetPassword.execute(body);
    res.status(200).json({ message: "Password reset successfully. Please log in again." });
  };
}
