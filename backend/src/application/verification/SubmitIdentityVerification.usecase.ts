import { IIdentityVerificationRepository } from "@/domain/repositories/IIdentityVerificationRepository";
import { IImageStorageService } from "@/domain/services/IImageStorageService";
import { IdentityDocumentType } from "@/domain/entities/IdentityVerification";
import { ValidationError } from "@/domain/errors/AppError";

export interface SubmitIdentityVerificationInput {
  userId: string;
  documentType: IdentityDocumentType;
  file: { buffer: Buffer };
}

/** Owner Verification (Part 5), self-service half: a user submits a photo
 * of an ID document. Reuses the same Cloudinary-backed
 * IImageStorageService Phase 3 built for property photos -- storing a
 * document image isn't meaningfully different from storing a listing
 * photo at the infrastructure level. */
export class SubmitIdentityVerificationUseCase {
  constructor(
    private readonly verificationRepo: IIdentityVerificationRepository,
    private readonly imageStorage: IImageStorageService,
  ) {}

  async execute(input: SubmitIdentityVerificationInput) {
    if (!input.file) {
      throw new ValidationError("A document image is required");
    }

    const uploaded = await this.imageStorage.upload({
      buffer: input.file.buffer,
      folder: `verifications/${input.userId}`,
    });

    return this.verificationRepo.create({
      userId: input.userId,
      documentType: input.documentType,
      documentImageUrl: uploaded.url,
    });
  }
}
