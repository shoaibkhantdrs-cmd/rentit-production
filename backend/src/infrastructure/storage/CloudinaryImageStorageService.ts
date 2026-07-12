import { v2 as cloudinary } from "cloudinary";
import {
  IImageStorageService,
  UploadedImage,
  UploadImageInput,
} from "@/domain/services/IImageStorageService";
import { ValidationError } from "@/domain/errors/AppError";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Real Cloudinary integration (the `cloudinary` npm SDK, not a mock).
 * Resize/compression are expressed as upload-time transformations rather
 * than done locally with an image library: `limit` never upscales,
 * `quality: auto` and `fetch_format: auto` let Cloudinary pick the best
 * compressed encoding per requesting browser (WebP/AVIF where supported).
 */
export class CloudinaryImageStorageService implements IImageStorageService {
  constructor(config: CloudinaryConfig) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async upload(input: UploadImageInput): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: input.folder,
          resource_type: "image",
          transformation: [
            { width: 2000, height: 2000, crop: "limit" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(new ValidationError(`Image upload failed: ${error?.message ?? "unknown error"}`));
            return;
          }
          resolve({
            publicId: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        },
      );
      uploadStream.end(input.buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  }
}
