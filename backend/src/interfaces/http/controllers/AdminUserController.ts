import { Request, Response } from "express";
import { z } from "zod";
import { SearchUsersUseCase } from "@/application/admin/users/SearchUsers.usecase";
import { GetUserProfileUseCase } from "@/application/admin/users/GetUserProfile.usecase";
import { UpdateUserStatusUseCase } from "@/application/admin/users/UpdateUserStatus.usecase";
import { AdminDeleteUserUseCase } from "@/application/admin/users/AdminDeleteUser.usecase";
import { AdminResetUserPasswordUseCase } from "@/application/admin/users/AdminResetUserPassword.usecase";
import { UpdateUserRolesUseCase } from "@/application/admin/users/UpdateUserRoles.usecase";
import { GetUserActivityUseCase } from "@/application/admin/users/GetUserActivity.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  searchUsersQuerySchema,
  updateUserRolesSchema,
  updateUserStatusSchema,
  paginationQuerySchema,
} from "@/interfaces/http/validators/admin.schemas";

/** Admin User Management (Phase 4 Part 2). */
export class AdminUserController {
  constructor(
    private readonly searchUsers: SearchUsersUseCase,
    private readonly getUserProfile: GetUserProfileUseCase,
    private readonly updateUserStatus: UpdateUserStatusUseCase,
    private readonly adminDeleteUser: AdminDeleteUserUseCase,
    private readonly adminResetUserPassword: AdminResetUserPasswordUseCase,
    private readonly updateUserRoles: UpdateUserRolesUseCase,
    private readonly getUserActivity: GetUserActivityUseCase,
  ) {}

  search = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof searchUsersQuerySchema>;
    const result = await this.searchUsers.execute(query);
    res.status(200).json(result);
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getUserProfile.execute(req.params.id);
    res.status(200).json(result);
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updateUserStatusSchema>;
    const result = await this.updateUserStatus.execute({
      targetUserId: req.params.id,
      status: body.status,
      reason: body.reason,
      actorId: req.user.sub,
      actorRoles: req.user.roles,
    });
    res.status(200).json(result);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.adminDeleteUser.execute({
      targetUserId: req.params.id,
      actorId: req.user.sub,
      actorRoles: req.user.roles,
    });
    res.status(204).send();
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.adminResetUserPassword.execute({
      targetUserId: req.params.id,
      actorId: req.user.sub,
      actorRoles: req.user.roles,
    });
    res.status(202).json({ message: "A password reset code has been sent to the user." });
  };

  updateRoles = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updateUserRolesSchema>;
    const result = await this.updateUserRoles.execute({
      targetUserId: req.params.id,
      roleNames: body.roleNames,
      actorId: req.user.sub,
      actorRoles: req.user.roles,
    });
    res.status(200).json(result);
  };

  activity = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof paginationQuerySchema>;
    const result = await this.getUserActivity.execute({
      targetUserId: req.params.id,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };
}
