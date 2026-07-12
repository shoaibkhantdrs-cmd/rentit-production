import { Request, Response } from "express";
import { z } from "zod";
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
import { ListPropertyCategoriesUseCase } from "@/application/properties/ListPropertyCategories.usecase";
import { GetRecentlyViewedUseCase } from "@/application/properties/GetRecentlyViewed.usecase";
import { GetRecommendationsUseCase } from "@/application/properties/GetRecommendations.usecase";
import { UnauthorizedError, ValidationError } from "@/domain/errors/AppError";
import {
  createPropertySchema,
  updatePropertySchema,
  searchPropertiesQuerySchema,
  reportPropertySchema,
  paginationQuerySchema,
  recommendationsQuerySchema,
} from "@/interfaces/http/validators/property.schemas";

export class PropertyController {
  constructor(
    private readonly createProperty: CreatePropertyUseCase,
    private readonly getProperty: GetPropertyUseCase,
    private readonly searchProperties: SearchPropertiesUseCase,
    private readonly updateProperty: UpdatePropertyUseCase,
    private readonly deleteProperty: DeletePropertyUseCase,
    private readonly uploadPropertyImages: UploadPropertyImagesUseCase,
    private readonly deletePropertyImage: DeletePropertyImageUseCase,
    private readonly favoriteProperty: FavoritePropertyUseCase,
    private readonly unfavoriteProperty: UnfavoritePropertyUseCase,
    private readonly reportProperty: ReportPropertyUseCase,
    private readonly getMyProperties: GetMyPropertiesUseCase,
    private readonly getMyFavorites: GetMyFavoritesUseCase,
    private readonly listCategories: ListPropertyCategoriesUseCase,
    private readonly getRecentlyViewed: GetRecentlyViewedUseCase,
    private readonly getRecommendations: GetRecommendationsUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof createPropertySchema>;
    const result = await this.createProperty.execute({ ...body, ownerId: req.user.sub });
    res.status(201).json(result);
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof searchPropertiesQuerySchema>;
    const result = await this.searchProperties.execute({
      categorySlug: query.category,
      propertyType: query.propertyType,
      rentMin: query.rentMin,
      rentMax: query.rentMax,
      bedroomsMin: query.bedroomsMin,
      bathroomsMin: query.bathroomsMin,
      parkingMin: query.parkingMin,
      areaMin: query.areaMin,
      areaMax: query.areaMax,
      city: query.city,
      locality: query.locality,
      furnished: query.furnished,
      availableFrom: query.availableFrom,
      latitude: query.lat,
      longitude: query.lng,
      radiusKm: query.radiusKm,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = await this.getProperty.execute({
      propertyId: req.params.id,
      viewerUserId: req.user?.sub ?? null,
      viewerRoles: req.user?.roles ?? [],
      ipAddress: req.deviceContext.ipAddress,
      userAgent: req.deviceContext.userAgent,
    });
    res.status(200).json(result);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof updatePropertySchema>;
    const result = await this.updateProperty.execute({
      propertyId: req.params.id,
      requesterId: req.user.sub,
      requesterRoles: req.user.roles,
      ...body,
    });
    res.status(200).json(result);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.deleteProperty.execute({
      propertyId: req.params.id,
      requesterId: req.user.sub,
      requesterRoles: req.user.roles,
    });
    res.status(204).send();
  };

  uploadImages = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new ValidationError("Attach at least one image file under the 'images' field");
    }
    const result = await this.uploadPropertyImages.execute({
      propertyId: req.params.id,
      requesterId: req.user.sub,
      requesterRoles: req.user.roles,
      files: files.map((f) => ({ buffer: f.buffer })),
    });
    res.status(201).json(result);
  };

  deleteImage = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.deletePropertyImage.execute({
      propertyId: req.params.id,
      imageId: req.params.imageId,
      requesterId: req.user.sub,
      requesterRoles: req.user.roles,
    });
    res.status(204).send();
  };

  favorite = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.favoriteProperty.execute(req.params.id, req.user.sub);
    res.status(200).json(result);
  };

  unfavorite = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.unfavoriteProperty.execute(req.params.id, req.user.sub);
    res.status(200).json(result);
  };

  report = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof reportPropertySchema>;
    await this.reportProperty.execute({
      propertyId: req.params.id,
      reporterUserId: req.user.sub,
      reason: body.reason,
      details: body.details,
    });
    res.status(201).json({ message: "Report submitted. Thank you for helping keep listings accurate." });
  };

  mine = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof paginationQuerySchema>;
    const result = await this.getMyProperties.execute({
      ownerId: req.user.sub,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };

  favorites = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof paginationQuerySchema>;
    const result = await this.getMyFavorites.execute({
      userId: req.user.sub,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };

  categories = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.listCategories.execute();
    res.status(200).json({ items: result });
  };

  recentlyViewed = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.getRecentlyViewed.execute(req.user.sub);
    res.status(200).json(result);
  };

  recommendationsForProperty = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof recommendationsQuerySchema>;
    const result = await this.getRecommendations.execute({
      propertyId: req.params.id,
      userId: req.user?.sub,
      limit: query.limit,
    });
    res.status(200).json(result);
  };

  recommendationsForMe = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof recommendationsQuerySchema>;
    const result = await this.getRecommendations.execute({ userId: req.user.sub, limit: query.limit });
    res.status(200).json(result);
  };
}
