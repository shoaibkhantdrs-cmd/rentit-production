import { Pool } from "pg";
import { IRoleRepository } from "@/domain/repositories/IRoleRepository";
import { Role } from "@/domain/entities/Role";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class RoleRepository implements IRoleRepository {
  constructor(private readonly pool: Pool) {}

  async findByName(name: string): Promise<Role | null> {
    const result = await this.pool.query<RoleRow>(
      "SELECT * FROM roles WHERE name = $1 AND deleted_at IS NULL",
      [name],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findAll(): Promise<Role[]> {
    const result = await this.pool.query<RoleRow>(
      "SELECT * FROM roles WHERE deleted_at IS NULL ORDER BY name",
    );
    return result.rows.map(toEntity);
  }
}
