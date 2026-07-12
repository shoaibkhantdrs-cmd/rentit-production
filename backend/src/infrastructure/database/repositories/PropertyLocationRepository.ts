import { Pool } from "pg";
import { IPropertyLocationRepository } from "@/domain/repositories/IPropertyLocationRepository";
import { NewPropertyLocation, PropertyLocation } from "@/domain/entities/PropertyLocation";

interface PropertyLocationRow {
  id: string;
  property_id: string;
  address_line: string;
  city: string;
  locality: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: string;
  longitude: string;
  formatted_address: string | null;
  place_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: PropertyLocationRow): PropertyLocation {
  return {
    id: row.id,
    propertyId: row.property_id,
    addressLine: row.address_line,
    city: row.city,
    locality: row.locality,
    state: row.state,
    country: row.country,
    postalCode: row.postal_code,
    latitude: parseFloat(row.latitude),
    longitude: parseFloat(row.longitude),
    formattedAddress: row.formatted_address,
    placeId: row.place_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PropertyLocationRepository implements IPropertyLocationRepository {
  constructor(private readonly pool: Pool) {}

  async findByPropertyId(propertyId: string): Promise<PropertyLocation | null> {
    const result = await this.pool.query<PropertyLocationRow>(
      "SELECT * FROM property_locations WHERE property_id = $1",
      [propertyId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findByPropertyIds(propertyIds: string[]): Promise<PropertyLocation[]> {
    if (propertyIds.length === 0) return [];
    const result = await this.pool.query<PropertyLocationRow>(
      "SELECT * FROM property_locations WHERE property_id = ANY($1::uuid[])",
      [propertyIds],
    );
    return result.rows.map(toEntity);
  }

  async upsert(input: NewPropertyLocation): Promise<PropertyLocation> {
    const result = await this.pool.query<PropertyLocationRow>(
      `INSERT INTO property_locations (
         property_id, address_line, city, locality, state, country, postal_code,
         latitude, longitude, formatted_address, place_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (property_id) DO UPDATE SET
         address_line = EXCLUDED.address_line,
         city = EXCLUDED.city,
         locality = EXCLUDED.locality,
         state = EXCLUDED.state,
         country = EXCLUDED.country,
         postal_code = EXCLUDED.postal_code,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         formatted_address = EXCLUDED.formatted_address,
         place_id = EXCLUDED.place_id
       RETURNING *`,
      [
        input.propertyId,
        input.addressLine,
        input.city,
        input.locality,
        input.state,
        input.country,
        input.postalCode,
        input.latitude,
        input.longitude,
        input.formattedAddress,
        input.placeId,
      ],
    );
    return toEntity(result.rows[0]);
  }
}
