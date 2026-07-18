"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPropertyTestContainer = buildPropertyTestContainer;
const PropertyDetailLoader_1 = require("@/application/properties/shared/PropertyDetailLoader");
const CreateProperty_usecase_1 = require("@/application/properties/CreateProperty.usecase");
const GetProperty_usecase_1 = require("@/application/properties/GetProperty.usecase");
const SearchProperties_usecase_1 = require("@/application/properties/SearchProperties.usecase");
const UpdateProperty_usecase_1 = require("@/application/properties/UpdateProperty.usecase");
const DeleteProperty_usecase_1 = require("@/application/properties/DeleteProperty.usecase");
const UploadPropertyImages_usecase_1 = require("@/application/properties/UploadPropertyImages.usecase");
const DeletePropertyImage_usecase_1 = require("@/application/properties/DeletePropertyImage.usecase");
const FavoriteProperty_usecase_1 = require("@/application/properties/FavoriteProperty.usecase");
const UnfavoriteProperty_usecase_1 = require("@/application/properties/UnfavoriteProperty.usecase");
const ReportProperty_usecase_1 = require("@/application/properties/ReportProperty.usecase");
const GetMyProperties_usecase_1 = require("@/application/properties/GetMyProperties.usecase");
const GetMyFavorites_usecase_1 = require("@/application/properties/GetMyFavorites.usecase");
const FakeClock_1 = require("./fakes/FakeClock");
const InMemoryUserRepository_1 = require("./fakes/InMemoryUserRepository");
const InMemoryActivityLogRepository_1 = require("./fakes/InMemoryActivityLogRepository");
const InMemoryAuditLogRepository_1 = require("./fakes/InMemoryAuditLogRepository");
const InMemoryPropertyRepository_1 = require("./fakes/InMemoryPropertyRepository");
const InMemoryPropertyCategoryRepository_1 = require("./fakes/InMemoryPropertyCategoryRepository");
const InMemoryPropertyLocationRepository_1 = require("./fakes/InMemoryPropertyLocationRepository");
const InMemoryPropertyImageRepository_1 = require("./fakes/InMemoryPropertyImageRepository");
const InMemoryPropertyFeatureRepository_1 = require("./fakes/InMemoryPropertyFeatureRepository");
const InMemoryPropertyViewRepository_1 = require("./fakes/InMemoryPropertyViewRepository");
const InMemoryPropertyFavoriteRepository_1 = require("./fakes/InMemoryPropertyFavoriteRepository");
const InMemoryPropertyReportRepository_1 = require("./fakes/InMemoryPropertyReportRepository");
const InMemoryPropertyStatusHistoryRepository_1 = require("./fakes/InMemoryPropertyStatusHistoryRepository");
const FakeImageStorageService_1 = require("./fakes/FakeImageStorageService");
const FakeGeocodingService_1 = require("./fakes/FakeGeocodingService");
/**
 * Wires the exact same 12 property use-cases the real app uses, backed
 * entirely by in-memory fakes instead of Postgres/Cloudinary/Google Maps.
 * Mirrors buildTestContainer.ts's approach for the auth/user domain.
 */
function buildPropertyTestContainer() {
    const clock = new FakeClock_1.FakeClock();
    const userRepo = new InMemoryUserRepository_1.InMemoryUserRepository();
    const activityLogRepo = new InMemoryActivityLogRepository_1.InMemoryActivityLogRepository();
    const auditLogRepo = new InMemoryAuditLogRepository_1.InMemoryAuditLogRepository();
    // Constructed before propertyRepo: InMemoryPropertyRepository.search()
    // needs a reference to it to emulate the real repo's SQL JOIN against
    // property_locations for the city/locality/radius filters.
    const locationRepo = new InMemoryPropertyLocationRepository_1.InMemoryPropertyLocationRepository();
    const propertyRepo = new InMemoryPropertyRepository_1.InMemoryPropertyRepository(locationRepo);
    const categoryRepo = new InMemoryPropertyCategoryRepository_1.InMemoryPropertyCategoryRepository();
    const imageRepo = new InMemoryPropertyImageRepository_1.InMemoryPropertyImageRepository();
    const featureRepo = new InMemoryPropertyFeatureRepository_1.InMemoryPropertyFeatureRepository();
    const viewRepo = new InMemoryPropertyViewRepository_1.InMemoryPropertyViewRepository(clock);
    const favoriteRepo = new InMemoryPropertyFavoriteRepository_1.InMemoryPropertyFavoriteRepository();
    const reportRepo = new InMemoryPropertyReportRepository_1.InMemoryPropertyReportRepository();
    const statusHistoryRepo = new InMemoryPropertyStatusHistoryRepository_1.InMemoryPropertyStatusHistoryRepository();
    const imageStorage = new FakeImageStorageService_1.FakeImageStorageService();
    const geocodingService = new FakeGeocodingService_1.FakeGeocodingService();
    const detailLoader = new PropertyDetailLoader_1.PropertyDetailLoader(categoryRepo, userRepo, locationRepo, imageRepo, featureRepo, favoriteRepo);
    const createProperty = new CreateProperty_usecase_1.CreatePropertyUseCase(propertyRepo, categoryRepo, locationRepo, featureRepo, statusHistoryRepo, geocodingService, detailLoader);
    const getProperty = new GetProperty_usecase_1.GetPropertyUseCase(propertyRepo, viewRepo, detailLoader);
    const searchProperties = new SearchProperties_usecase_1.SearchPropertiesUseCase(propertyRepo, locationRepo, imageRepo, categoryRepo);
    const updateProperty = new UpdateProperty_usecase_1.UpdatePropertyUseCase(propertyRepo, locationRepo, featureRepo, statusHistoryRepo, geocodingService, clock, detailLoader);
    const deleteProperty = new DeleteProperty_usecase_1.DeletePropertyUseCase(propertyRepo, statusHistoryRepo);
    const uploadPropertyImages = new UploadPropertyImages_usecase_1.UploadPropertyImagesUseCase(propertyRepo, imageRepo, imageStorage);
    const deletePropertyImage = new DeletePropertyImage_usecase_1.DeletePropertyImageUseCase(propertyRepo, imageRepo, imageStorage);
    const favoriteProperty = new FavoriteProperty_usecase_1.FavoritePropertyUseCase(propertyRepo, favoriteRepo, activityLogRepo);
    const unfavoriteProperty = new UnfavoriteProperty_usecase_1.UnfavoritePropertyUseCase(propertyRepo, favoriteRepo, activityLogRepo);
    const reportProperty = new ReportProperty_usecase_1.ReportPropertyUseCase(propertyRepo, reportRepo, auditLogRepo);
    const getMyProperties = new GetMyProperties_usecase_1.GetMyPropertiesUseCase(propertyRepo, detailLoader);
    const getMyFavorites = new GetMyFavorites_usecase_1.GetMyFavoritesUseCase(propertyRepo, favoriteRepo, detailLoader);
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
