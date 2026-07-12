import {
  IImageStorageService,
  UploadedImage,
  UploadImageInput,
} from "@/domain/services/IImageStorageService";

/** Stands in for Cloudinary -- "uploads" just record the buffer size and hand back a deterministic fake URL. */
export class FakeImageStorageService implements IImageStorageService {
  public readonly uploaded: UploadImageInput[] = [];
  public readonly destroyed: string[] = [];
  private counter = 0;

  async upload(input: UploadImageInput): Promise<UploadedImage> {
    this.uploaded.push(input);
    this.counter += 1;
    const publicId = `${input.folder}/fake-${this.counter}`;
    return {
      publicId,
      url: `https://res.cloudinary.test/${publicId}.jpg`,
      width: 1200,
      height: 800,
      format: "jpg",
      bytes: input.buffer.byteLength,
    };
  }

  async destroy(publicId: string): Promise<void> {
    this.destroyed.push(publicId);
  }
}
