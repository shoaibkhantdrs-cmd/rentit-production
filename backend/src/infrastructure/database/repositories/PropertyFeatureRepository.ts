import { Pool } from "pg";
import { IPropertyFeatureRepository } from "@/domain/repositories/IPropertyFeatureRepository";
import { PropertyFeature } from "@/domain/entities/PropertyFeature";

interface PropertyFeatureRow {
  id: string;
  property_id: string;
  feature_key: string;
  created_at: Date;
}

function toEntity(row: PropertyFeatureRow): PropertyFeature {
  return {
    id: row.id,
    propertyId: row.property_id,
    featureKey: row.feature_key,
    createdAt: row.created_at,
  };
}

export class PropertyFeatureRepository implements IPropertyFeatureRepository {
  constructor(private readonly pool: Pool) {}

  async listForProperty(propertyId: string): Promise<PropertyFeature[]> {
    const result = await this.pool.query<PropertyFeatureRow>(
      "SELECT * FROM property_features WHERE property_id = $1 ORDER BY feature_key",
      [propertyId],
    );
    return result.rows.map(toEntity);
  }

  async setForProperty(propertyId: string, featureKeys: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM property_features WHERE property_id = $1", [propertyId]);

      const uniqueKeys = [...new Set(featureKeys)];
      for (const key of uniqueKeys) {
        await client.query(
          "INSERT INTO property_features (property_id, feature_key) VALUES ($1, $2)",
          [propertyId, key],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
