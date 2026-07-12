import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { InMemoryRoleRepository } from "./InMemoryRoleRepository";

export class InMemoryUserRoleRepository implements IUserRoleRepository {
  // Map<userId, Set<roleId>>
  public readonly assignments = new Map<string, Set<string>>();

  constructor(private readonly roleRepo: InMemoryRoleRepository) {}

  async assign(userId: string, roleId: string, _assignedBy: string | null = null): Promise<void> {
    const set = this.assignments.get(userId) ?? new Set<string>();
    set.add(roleId);
    this.assignments.set(userId, set);
  }

  async remove(userId: string, roleId: string): Promise<void> {
    this.assignments.get(userId)?.delete(roleId);
  }

  async listRoleNamesForUser(userId: string): Promise<string[]> {
    const roleIds = this.assignments.get(userId) ?? new Set<string>();
    const names: string[] = [];
    for (const roleId of roleIds) {
      const role = this.roleRepo.roles.get(roleId);
      if (role && !role.deletedAt) names.push(role.name);
    }
    return names;
  }
}
