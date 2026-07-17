import { ChangeEvent, useState } from "react";
import { propertiesApi } from "@/api/properties";
import { PropertyImageDTO } from "@/api/types";
import { ApiError } from "@/api/httpClient";

const MAX_IMAGES = 10;

/**
 * Shared by Add Property (right after creating a draft) and Edit Property
 * (ongoing management): upload up to 10 photos and delete existing ones.
 * Resize/compression happens server-side via Cloudinary transformations
 * (see backend/src/infrastructure/storage/CloudinaryImageStorageService.ts)
 * -- the browser just sends the original file.
 */
export function ImageUploadManager({
  propertyId,
  images,
  onChange,
}: {
  propertyId: string;
  images: PropertyImageDTO[];
  onChange: (images: PropertyImageDTO[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remainingSlots = MAX_IMAGES - images.length;

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (files.length > remainingSlots) {
      setError(`You can add at most ${remainingSlots} more photo(s) (10 maximum per listing).`);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const uploaded = await propertiesApi.uploadImages(propertyId, files);
      onChange([
        ...images,
        ...uploaded.map((img) => ({
          id: img.id,
          url: img.url,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder,
          width: null,
          height: null,
        })),
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not upload photos. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    setDeletingId(imageId);
    setError(null);
    try {
      await propertiesApi.deleteImage(propertyId, imageId);
      onChange(images.filter((img) => img.id !== imageId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this photo.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="form-section">
      <h2>Photos</h2>
      {error ? <div className="alert alert--error">{error}</div> : null}

      {images.length > 0 && (
        <div className="property-grid" style={{ marginBottom: 16 }}>
          {[...images]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((img) => (
              <div key={img.id} className="card">
                <div className="property-card__image">
                  <img src={img.url} alt="" loading="lazy" decoding="async" />
                </div>
                <div className="property-card__body" style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  {img.isPrimary ? <span className="pill-badge pill-badge--status">Primary</span> : <span />}
                  <button
                    type="button"
                    className="btn-v2 btn-v2--danger btn-v2--sm"
                    onClick={() => handleDelete(img.id)}
                    disabled={deletingId === img.id}
                  >
                    {deletingId === img.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {remainingSlots > 0 ? (
        <div className="field">
          <label htmlFor="photo-upload">Add photos ({remainingSlots} remaining, JPEG/PNG/WebP)</label>
          <input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} disabled={uploading} />
          {uploading ? <p className="field-hint">Uploading...</p> : null}
        </div>
      ) : (
        <p className="field-hint">Maximum of {MAX_IMAGES} photos reached.</p>
      )}
    </div>
  );
}
