import {
  AdminPropertySearchOptions,
  AdminPropertySearchResult,
  AdminPropertySort,
  IPropertyRepository,
  PropertySearchOptions,
  PropertySearchResult,
} from "@/domain/repositories/IPropertyRepository";
import { NewProperty, Property, PropertyUpdatePatch } from "@/domain/entities/Property";
import { haversineDistanceKm } from "@/application/properties/shared/haversine";
import { InMemoryPropertyLocationRepository } from "./InMemoryPropertyLocationRepository";
import { newId } from "./ids";

const SORTERS: Record<PropertySearchOptions["sort"], (a: Property, b: Property) => number> = {
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  most_viewed: (a, b) => b.viewCount - a.viewCount,
  price_low_to_high: (a, b) => a.rentAmount - b.rentAmount,
  price_high_to_low: (a, b) => b.rentAmount - a.rentAmount,
};

const ADMIN_SORTERS: Record<AdminPropertySort, (a: Property, b: Property) => number> = {
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  oldest: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  most_viewed: (a, b) => b.viewCount - a.viewCount,
  most_favorited: (a, b) => b.favoriteCount - a.favoriteCount,
};

/**
 * In-memory stand-in for the real PropertyRepository. `search()` mirrors
 * the exact filter/sort/pagination semantics of
 * infrastructure/database/buildPropertySearchQuery.ts (always
 * status='published' + deleted_at IS NULL, city/locality as
 * case-insensitive substring match, bounding-box + exact Haversine radius
 * filter) so that SearchPropertiesUseCase can be integration-tested
 * end-to-end without a live Postgres connection. Needs a reference to the
 * location fake to perform the equivalent of the real repo's SQL JOIN.
 */
export class InMemoryPropertyRepository implements IPropertyRepository {
  public readonly properties = new Map<string, Property>();

  constructor(private readonly locationRepo: InMemoryPropertyLocationRepository) {}

  async create(data: NewProperty): Promise<Property> {
    const now = new Date();
    const property: Property = {
      id: newId(),
      ownerId: data.ownerId,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      propertyType: data.propertyType,
      status: "draft",
      rentAmount: data.rentAmount,
      securityDeposit: data.securityDeposit,
      areaSqft: data.areaSqft,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      parkingSpaces: data.parkingSpaces,
      floorNumber: data.floorNumber ?? null,
      totalFloors: data.totalFloors ?? null,
      facing: data.facing ?? null,
      furnishedStatus: data.furnishedStatus,
      availableFrom: data.availableFrom,
      viewCount: 0,
      favoriteCount: 0,
      publishedAt: null,
      isFeatured: false,
      moderatedBy: null,
      moderatedAt: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.properties.set(property.id, property);
    return property;
  }

  async findById(id: string): Promise<Property | null> {
    return this.properties.get(id) ?? null;
  }

  async update(id: string, patch: PropertyUpdatePatch): Promise<Property> {
    const existing = this.properties.get(id);
    if (!existing) throw new Error(`Property ${id} not found`);
    const updated: Property = { ...existing, updatedAt: new Date() };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (updated as Record<string, unknown>)[key] = value;
      }
    }
    this.properties.set(id, updated);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.properties.get(id);
    if (!existing) return;
    this.properties.set(id, { ...existing, deletedAt: new Date() });
  }

  async incrementViewCount(id: string): Promise<void> {
    const existing = this.properties.get(id);
    if (!existing) return;
    this.properties.set(id, { ...existing, viewCount: existing.viewCount + 1 });
  }

  async adjustFavoriteCount(id: string, delta: 1 | -1): Promise<void> {
    const existing = this.properties.get(id);
    if (!existing) return;
    this.properties.set(id, {
      ...existing,
      favoriteCount: Math.max(0, existing.favoriteCount + delta),
    });
  }

  async findByOwner(
    ownerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Property[]; total: number }> {
    const all = Array.from(this.properties.values())
      .filter((p) => p.ownerId === ownerId && !p.deletedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }

  async findManyByIds(ids: string[]): Promise<Property[]> {
    if (ids.length === 0) return [];
    return ids
      .map((id) => this.properties.get(id))
      .filter((p): p is Property => Boolean(p) && !p!.deletedAt);
  }

  async search(options: PropertySearchOptions): Promise<PropertySearchResult> {
    const { filters } = options;

    let candidates = Array.from(this.properties.values()).filter(
      (p) => !p.deletedAt && p.status === "published",
    );

    if (filters.categoryId) candidates = candidates.filter((p) => p.categoryId === filters.categoryId);
    if (filters.propertyType)
      candidates = candidates.filter((p) => p.propertyType === filters.propertyType);
    if (filters.rentMin !== undefined) candidates = candidates.filter((p) => p.rentAmount >= filters.rentMin!);
    if (filters.rentMax !== undefined) candidates = candidates.filter((p) => p.rentAmount <= filters.rentMax!);
    if (filters.bedroomsMin !== undefined)
      candidates = candidates.filter((p) => p.bedrooms >= filters.bedroomsMin!);
    if (filters.bathroomsMin !== undefined)
      candidates = candidates.filter((p) => p.bathrooms >= filters.bathroomsMin!);
    if (filters.parkingMin !== undefined)
      candidates = candidates.filter((p) => p.parkingSpaces >= filters.parkingMin!);
    if (filters.areaMin !== undefined) candidates = candidates.filter((p) => p.areaSqft >= filters.areaMin!);
    if (filters.areaMax !== undefined) candidates = candidates.filter((p) => p.areaSqft <= filters.areaMax!);
    if (filters.furnished) candidates = candidates.filter((p) => p.furnishedStatus === filters.furnished);
    if (filters.availableFrom)
      candidates = candidates.filter((p) => p.availableFrom <= filters.availableFrom!);

    const withLocation = candidates.map((property) => ({
      property,
      location: this.locationRepo.byPropertyId.get(property.id) ?? null,
    }));

    let filtered = withLocation;
    if (filters.city) {
      const needle = filters.city.toLowerCase();
      filtered = filtered.filter((row) => row.location?.city.toLowerCase().includes(needle));
    }
    if (filters.locality) {
      const needle = filters.locality.toLowerCase();
      filtered = filtered.filter((row) => row.location?.locality?.toLowerCase().includes(needle));
    }

    let withDistance = filtered.map((row) => ({ ...row, distanceKm: null as number | null }));
    if (
      filters.latitude !== undefined &&
      filters.longitude !== undefined &&
      filters.radiusKm !== undefined
    ) {
      withDistance = withDistance
        .filter((row) => row.location !== null)
        .map((row) => ({
          ...row,
          distanceKm: haversineDistanceKm(
            filters.latitude!,
            filters.longitude!,
            row.location!.latitude,
            row.location!.longitude,
          ),
        }))
        .filter((row) => row.distanceKm! <= filters.radiusKm!);
    }

    const sorted = withDistance
      .slice()
      .sort((a, b) => SORTERS[options.sort](a.property, b.property));

    const total = sorted.length;
    const offset = (options.page - 1) * options.pageSize;
    const page = sorted.slice(offset, offset + options.pageSize);

    return {
      items: page.map((row) => ({ property: row.property, distanceKm: row.distanceKm })),
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  async adminSearch(options: AdminPropertySearchOptions): Promise<AdminPropertySearchResult> {
    const { filters } = options;

    let candidates = Array.from(this.properties.values()).filter((p) => !p.deletedAt);

    if (filters.status) candidates = candidates.filter((p) => p.status === filters.status);
    if (filters.categoryId) candidates = candidates.filter((p) => p.categoryId === filters.categoryId);
    if (filters.ownerId) candidates = candidates.filter((p) => p.ownerId === filters.ownerId);
    if (filters.isFeatured !== undefined)
      candidates = candidates.filter((p) => p.isFeatured === filters.isFeatured);
    if (filters.createdFrom)
      candidates = candidates.filter((p) => p.createdAt >= filters.createdFrom!);
    if (filters.createdTo) candidates = candidates.filter((p) => p.createdAt <= filters.createdTo!);
    if (filters.city) {
      const needle = filters.city.toLowerCase();
      candidates = candidates.filter((p) =>
        this.locationRepo.byPropertyId.get(p.id)?.city.toLowerCase().includes(needle),
      );
    }

    const sorted = candidates.slice().sort(ADMIN_SORTERS[options.sort]);
    const total = sorted.length;
    const offset = (options.page - 1) * options.pageSize;

    return {
      items: sorted.slice(offset, offset + options.pageSize),
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  }
}
