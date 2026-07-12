import { PropertyDetailLoader } from "@/application/properties/shared/PropertyDetailLoader";
import { CreatePropertyUseCase } from "@/application/properties/CreateProperty.usecase";
import { GetPropertyUseCase } from "@/application/properties/GetProperty.usecase";
import { SearchPropertiesUseCase } from "@/application/properties/SearchProperties.usecase";
import { UpdatePropertyUseCase } from "@/application/properties/UpdateProperty.usecase";
import { DeletePropertyUseCase } from "@/application/properties/DeleteProperty.usecase";
import { UploadPropertyImagesUseCase } from "@/application/properties/UploadPropertyImages.usecase";
import { DeletePropertyImageUseCase } from "@/application/properties/DeletePropertyImage.usecase";
import { FavoritePropertyUseCase } from "@/application/properties/FavoriteProperty.usecase";
import { UnfavoritePropertyUseCase } from "@/application/properties/UnfavoriteProperty.usecase";
import { ReportPropertyUseCase } from "@/application/properties/ReportProperty.usecase";
import { GetMyPropertiesUseCase } from "@/application/properties/GetMyProperties.usecase";
import { GetMyFavoritesUseCase } from "@/application/properties/GetMyFavorites.usecase";

import { FakeClock } from "./fakes/FakeClock";
import { InMemoryUserRepository } from "./fakes/InMemoryUserRepository";
import { InMemoryActivityLogRepository } from "./fakes/InMemoryActivityLogRepository";
import { InMemoryAuditLogRepository } from "./fakes/InMemoryAuditLogRepository";
import { InMemoryPropertyRepository } from "./fakes/InMemoryPropertyRepository";
import { InMemoryPropertyCategoryRepository } from "./fakes/InMemoryPropertyCategoryRepository";
import { InMemoryPropertyLocationRepository } from "./fakes/InMemoryPropertyLocationRepository";
import { InMemoryPropertyImageRepository } from "./fakes/InMemoryPropertyImageRepository";
import { InMemoryPropertyFeatureRepository } from "./fakes/InMemoryPropertyFeatureRepository";
import { InMemoryPropertyViewRepository } from "./fakes/InMemoryPropertyViewRepository";
import { InMemoryPropertyFavoriteRepository } from "./fakes/InMemoryPropertyFavoriteRepository";
import { InMemoryPropertyReportRepository } from "./fakes/InMemoryPropertyReportRepository";
import { InMemoryPropertyStatusHistoryRepository } from "./fakes/InMemoryPropertyStatusHistoryRepository";
import { FakeImageStorageService } from "./fakes/FakeImageStorageService";
import { FakeGeocodingService } from "./fakes/FakeGeocodingService";

/**
 * Wires the exact same 12 property use-cases the real app uses, backed
 * entirely by in-memory fakes instead of Postgres/Cloudinary/Google Maps.
 * Mirrors buildTestContainer.ts's approach for the auth/user domain.
 */
export function buildPropertyTestContainer() {
  const clock = new FakeClock();

  const userRepo = new InMemoryUserRepository();
  const activityLogRepo = new InMemoryActivityLogRepository();
  const auditLogRepo = new InMemoryAuditLogRepository();

  // Constructed before propertyRepo: InMemoryPropertyRepository.search()
  // needs a reference to it to emulate the real repo's SQL JOIN against
  // property_locations for the city/locality/radius filters.
  const locationRepo = new InMemoryPropertyLocationRepository();
  const propertyRepo = new InMemoryPropertyRepository(locationRepo);

  const categoryRepo = new InMemoryPropertyCategoryRepository();
  const imageRepo = new InMemoryPropertyImageRepository();
  const featureRepo = new InMemoryPropertyFeatureRepository();
  const viewRepo = new InMemoryPropertyViewRepository(clock);
  const favoriteRepo = new InMemoryPropertyFavoriteRepository();
  const reportRepo = new InMemoryPropertyReportRepository();
  const statusHistoryRepo = new InMemoryPropertyStatusHistoryRepository();

  const imageStorage = new FakeImageStorageService();
  const geocodingService = new FakeGeocodingService();

  const detailLoader = new PropertyDetailLoader(
    categoryRepo,
    userRepo,
    locationRepo,
    imageRepo,
    featureRepo,
    favoriteRepo,
  );

  const createProperty = new CreatePropertyUseCase(
    propertyRepo,
    categoryRepo,
    locationRepo,
    featureRepo,
    statusHistoryRepo,
    geocodingService,
    detailLoader,
  );
  const getProperty = new GetPropertyUseCase(propertyRepo, viewRepo, detailLoader);
  const searchProperties = new SearchPropertiesUseCase(propertyRepo, locationRepo, imageRepo, categoryRepo);
  const updateProperty = new UpdatePropertyUseCase(
    propertyRepo,
    locationRepo,
    featureRepo,
    statusHistoryRepo,
    geocodingService,
    clock,
    detailLoader,
  );
  const deleteProperty = new DeletePropertyUseCase(propertyRepo, statusHistoryRepo);
  const uploadPropertyImages = new UploadPropertyImagesUseCase(propertyRepo, imageRepo, imageStorage);
  const deletePropertyImage = new DeletePropertyImageUseCase(propertyRepo, imageRepo, imageStorage);
  const favoriteProperty = new FavoritePropertyUseCase(propertyRepo, favoriteRepo, activityLogRepo);
  const unfavoriteProperty = new UnfavoritePropertyUseCase(propertyRepo, favoriteRepo, activityLogRepo);
  const reportProperty = new ReportPropertyUseCase(propertyRepo, reportRepo, auditLogRepo);
  const getMyProperties = new GetMyPropertiesUseCase(propertyRepo, detailLoader);
  const getMyFavorites = new GetMyFavoritesUseCase(propertyRepo, favoriteRepo, detailLoader);

  return {
    clock,
    createProperty,
    getProperty,
    searchProperties,
    updateProperty,
    deleteProperty,
    uploadPropertyImages,
    deletePropertyImage,
    favoriteProperty,
    unfavoriteProperty,
    reportProperty,
    getMyProperties,
    getMyFavorites,
    geocodingService,
    imageStorage,
    repos: {
      userRepo,
      activityLogRepo,
      auditLogRepo,
      propertyRepo,
      locationRepo,
      categoryRepo,
      imageRepo,
      featureRepo,
      viewRepo,
      favoriteRepo,
      reportRepo,
      statusHistoryRepo,
    },
  };
}
