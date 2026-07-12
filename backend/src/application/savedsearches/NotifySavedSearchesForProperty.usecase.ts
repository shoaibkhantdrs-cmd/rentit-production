import { ISavedSearchRepository } from "@/domain/repositories/ISavedSearchRepository";
import { IPropertyLocationRepository } from "@/domain/repositories/IPropertyLocationRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { IPushNotificationService } from "@/domain/services/IPushNotificationService";
import { IClock } from "@/domain/services/IClock";
import { Property } from "@/domain/entities/Property";
import { matchesSavedSearch } from "@/application/properties/shared/matchesSavedSearch";
import { isCategoryEnabled } from "@/application/notifications/NotificationPreferences";

/**
 * Phase 5 Part 5's "notify when new matching properties appear", run
 * against every saved search that has notifyOnMatch = true whenever a
 * property newly becomes published (called from ApprovePropertyUseCase --
 * see docs/phase-5.md for why this runs inline rather than on a
 * schedule: there's no background job runner in this codebase, and a
 * property only needs to be checked against saved searches once, at the
 * moment it becomes visible).
 */
export class NotifySavedSearchesForPropertyUseCase {
  constructor(
    private readonly savedSearchRepo: ISavedSearchRepository,
    private readonly propertyLocationRepo: IPropertyLocationRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly pushService: IPushNotificationService,
    private readonly clock: IClock,
  ) {}

  async execute(property: Property): Promise<void> {
    const [notifiable, location] = await Promise.all([
      this.savedSearchRepo.listAllNotifiable(),
      this.propertyLocationRepo.findByPropertyId(property.id),
    ]);

    const matches = notifiable.filter((search) => matchesSavedSearch(property, location, search.filters));
    const now = this.clock.now();

    await Promise.all(
      matches.map(async (search) => {
        await this.notificationRepo.create({
          userId: search.userId,
          type: "saved_search.match",
          title: `New match for "${search.name}"`,
          body: property.title,
          data: { savedSearchId: search.id, propertyId: property.id },
        });

        const wantsPush = await isCategoryEnabled(this.userPreferenceRepo, search.userId, "newProperties");
        if (wantsPush) {
          await this.pushService.send({
            userId: search.userId,
            title: `New match for "${search.name}"`,
            body: property.title,
            data: { savedSearchId: search.id, propertyId: property.id },
          });
        }

        await this.savedSearchRepo.update(search.id, { lastNotifiedAt: now });
      }),
    );
  }
}
