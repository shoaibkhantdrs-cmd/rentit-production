import { IPropertyRepository, AdminPropertySort } from "@/domain/repositories/IPropertyRepository";
import { Property } from "@/domain/entities/Property";

export interface AdminSearchPropertiesInput {
  status?: Property["status"];
  categoryId?: string;
  ownerId?: string;
  isFeatured?: boolean;
  city?: string;
  sort: AdminPropertySort;
  page: number;
  pageSize: number;
}

/**
 * Backs Part 3's Pending/Approved/Rejected/Hidden/Featured lists -- all
 * five are this same use-case with a different `status`/`isFeatured`
 * filter value (pending_review / published / rejected / inactive /
 * isFeatured=true respectively), not five separate endpoints.
 */
export class AdminSearchPropertiesUseCase {
  constructor(private readonly propertyRepo: IPropertyRepository) {}

  async execute(input: AdminSearchPropertiesInput) {
    return this.propertyRepo.adminSearch({
      filters: {
        status: input.status,
        categoryId: input.categoryId,
        ownerId: input.ownerId,
        isFeatured: input.isFeatured,
        city: input.city,
      },
      sort: input.sort,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
