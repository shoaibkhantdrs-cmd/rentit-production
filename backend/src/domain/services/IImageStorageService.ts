export interface UploadImageInput {
  buffer: Buffer;
  folder: string;
}

export interface UploadedImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

/**
 * Port over the image CDN (Cloudinary in production -- see
 * infrastructure/storage/CloudinaryImageStorageService.ts). Resize and
 * compression are expressed as upload-time transformation parameters by
 * the concrete implementation, not reinvented here with an image library.
 */
export interface IImageStorageService {
  upload(input: UploadImageInput): Promise<UploadedImage>;
  destroy(publicId: string): Promise<void>;
}
