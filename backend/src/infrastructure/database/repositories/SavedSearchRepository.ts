import { Pool } from "pg";
import {
  ISavedSearchRepository,
  NewSavedSearchInput,
  SavedSearchUpdatePatch,
} from "@/domain/repositories/ISavedSearchRepository";
import { SavedSearch, SavedSearchFilters } from "@/domain/entities/SavedSearch";

interface SavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  filters: SavedSearchFilters;
  notify_on_match: boolean;
  last_notified_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: SavedSearchRow): SavedSearch {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    filters: row.filters,
    notifyOnMatch: row.notify_on_match,
    lastNotifiedAt: row.last_notified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SavedSearchRepository implements ISavedSearchRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewSavedSearchInput): Promise<SavedSearch> {
    const result = await this.pool.query<SavedSearchRow>(
      `INSERT INTO saved_searches (user_id, name, filters, notify_on_match)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.userId, input.name, JSON.stringify(input.filters), input.notifyOnMatch],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<SavedSearch | null> {
    const result = await this.pool.query<SavedSearchRow>(
      `SELECT * FROM saved_searches WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async listForUser(userId: string): Promise<SavedSearch[]> {
    const result = await this.pool.query<SavedSearchRow>(
      `SELECT * FROM saved_searches WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(toEntity);
  }

  async update(id: string, patch: SavedSearchUpdatePatch): Promise<SavedSearch> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (patch.name !== undefined) {
      sets.push(`name = $${i++}`);
      values.push(patch.name);
    }
    if (patch.filters !== undefined) {
      sets.push(`filters = $${i++}`);
      values.push(JSON.stringify(patch.filters));
    }
    if (patch.notifyOnMatch !== undefined) {
      sets.push(`notify_on_match = $${i++}`);
      values.push(patch.notifyOnMatch);
    }
    if (patch.lastNotifiedAt !== undefined) {
      sets.push(`last_notified_at = $${i++}`);
      values.push(patch.lastNotifiedAt);
    }

    if (sets.length === 0) {
      const current = await this.findById(id);
      if (!current) throw new Error(`Saved search ${id} not found`);
      return current;
    }

    values.push(id);
    const result = await this.pool.query<SavedSearchRow>(
      `UPDATE saved_searches SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    if (!result.rows[0]) {
      throw new Error(`Saved search ${id} not found`);
    }
    return toEntity(result.rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(`UPDATE saved_searches SET deleted_at = now() WHERE id = $1`, [id]);
  }

  async listAllNotifiable(): Promise<SavedSearch[]> {
    const result = await this.pool.query<SavedSearchRow>(
      `SELECT * FROM saved_searches WHERE notify_on_match = true AND deleted_at IS NULL`,
    );
    return result.rows.map(toEntity);
  }
}
