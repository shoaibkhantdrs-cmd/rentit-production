import { IPropertyCategoryRepository } from "@/domain/repositories/IPropertyCategoryRepository";

export interface PropertyCategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

/**
 * Not one of the 12 endpoints explicitly listed in Phase 3's PART 2, but a
 * necessary supporting piece: the frontend's Add/Edit Property forms and
 * the Search page's Category filter both need to know real category
 * IDs/slugs, which only exist once migrations have run (they are not
 * predictable client-side constants). Mirrors how "current location" in
 * PART 6 was implicitly a frontend/browser-geolocation concern -- this is
 * the equivalent minimal plumbing for categories.
 */
export class ListPropertyCategoriesUseCase {
  constructor(private readonly categoryRepo: IPropertyCategoryRepository) {}

  async execute(): Promise<PropertyCategoryDTO[]> {
    const categories = await this.categoryRepo.findAll();
    return categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description }));
  }
}
