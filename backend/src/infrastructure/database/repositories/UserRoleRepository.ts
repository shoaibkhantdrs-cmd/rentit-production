import { Pool } from "pg";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";

export class UserRoleRepository implements IUserRoleRepository {
  constructor(private readonly pool: Pool) {}

  async assign(userId: string, roleId: string, assignedBy: string | null = null): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId, assignedBy],
    );
  }

  async remove(userId: string, roleId: string): Promise<void> {
    await this.pool.query("DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2", [
      userId,
      roleId,
    ]);
  }

  async listRoleNamesForUser(userId: string): Promise<string[]> {
    const result = await this.pool.query<{ name: string }>(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
       WHERE ur.user_id = $1`,
      [userId],
    );
    return result.rows.map((row) => row.name);
  }
}
