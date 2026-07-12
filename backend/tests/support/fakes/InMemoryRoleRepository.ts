import { IRoleRepository } from "@/domain/repositories/IRoleRepository";
import { Role, ROLE_NAMES } from "@/domain/entities/Role";
import { newId } from "./ids";

export class InMemoryRoleRepository implements IRoleRepository {
  public readonly roles = new Map<string, Role>();

  constructor(seed: boolean = true) {
    if (seed) {
      const now = new Date();
      for (const name of ROLE_NAMES) {
        const role: Role = {
          id: newId(),
          name,
          description: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        this.roles.set(role.id, role);
      }
    }
  }

  async findByName(name: string): Promise<Role | null> {
    for (const role of this.roles.values()) {
      if (role.name === name && !role.deletedAt) return role;
    }
    return null;
  }

  async findAll(): Promise<Role[]> {
    return [...this.roles.values()].filter((r) => !r.deletedAt);
  }
}
