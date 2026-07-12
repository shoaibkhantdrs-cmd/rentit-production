import { AdminPropertySearchOptions, AdminPropertySort } from "@/domain/repositories/IPropertyRepository";

const SORT_CLAUSES: Record<AdminPropertySort, string> = {
  newest: "p.created_at DESC",
  oldest: "p.created_at ASC",
  most_viewed: "p.view_count DESC",
  most_favorited: "p.favorite_count DESC",
};

export interface BuiltAdminQuery {
  itemsQuery: string;
  itemsValues: unknown[];
  countQuery: string;
  countValues: unknown[];
}

/**
 * Pure function counterpart to buildPropertySearchQuery.ts, but for the
 * admin-only browse path: no hardcoded `status = 'published'`, any status
 * is browsable, and filtering is by owner/featured/date range instead of
 * the public renter-facing filters (rent, bedrooms, radius, ...).
 */
export function buildAdminPropertySearchQuery(options: AdminPropertySearchOptions): BuiltAdminQuery {
  const { filters } = options;
  const conditions: string[] = ["p.deleted_at IS NULL"];
  const values: unknown[] = [];
  let paramIndex = 1;
  let needsLocationJoin = false;

  const push = (condition: string, value: unknown) => {
    conditions.push(condition.replace("?", `$${paramIndex}`));
    values.push(value);
    paramIndex += 1;
  };

  if (filters.status) push("p.status = ?", filters.status);
  if (filters.categoryId) push("p.category_id = ?", filters.categoryId);
  if (filters.ownerId) push("p.owner_id = ?", filters.ownerId);
  if (filters.isFeatured !== undefined) push("p.is_featured = ?", filters.isFeatured);
  if (filters.createdFrom) push("p.created_at >= ?", filters.createdFrom);
  if (filters.createdTo) push("p.created_at <= ?", filters.createdTo);
  if (filters.city) {
    needsLocationJoin = true;
    push("pl.city ILIKE ?", `%${filters.city}%`);
  }

  const whereClause = conditions.join(" AND ");
  const sortClause = SORT_CLAUSES[options.sort];
  const offset = (options.page - 1) * options.pageSize;

  const limitParam = paramIndex;
  const offsetParam = paramIndex + 1;
  const itemsValues = [...values, options.pageSize, offset];

  const fromClause = needsLocationJoin
    ? "FROM properties p JOIN property_locations pl ON pl.property_id = p.id"
    : "FROM properties p";

  const itemsQuery = `
      SELECT p.* ${fromClause}
      WHERE ${whereClause}
      ORDER BY ${sortClause}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

  const countQuery = `
      SELECT COUNT(*) ${fromClause}
      WHERE ${whereClause}
    `;

  return { itemsQuery, itemsValues, countQuery, countValues: values };
}
