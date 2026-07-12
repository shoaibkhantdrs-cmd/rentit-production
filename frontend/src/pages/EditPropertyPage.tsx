import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyForm, PropertyFormValues } from "@/components/PropertyForm";
import { ImageUploadManager } from "@/components/ImageUploadManager";
import { PropertyDetailSkeleton } from "@/components/Skeletons";
import { ErrorState } from "@/components/ErrorState";
import { PropertyStatus } from "@/api/types";

const STATUS_OPTIONS: PropertyStatus[] = [
  "draft",
  "pending_review",
  "published",
  "rented",
  "inactive",
  "removed",
];

function EditPropertyForm({ propertyId }: { propertyId: string }) {
  const navigate = useNavigate();
  const { status, data: property, error, reload } = useAsync(
    () => propertiesApi.getById(propertyId),
    [propertyId],
  );
  const [statusValue, setStatusValue] = useState<PropertyStatus | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (status === "loading") return <PropertyDetailSkeleton />;
  if (status === "error") return <ErrorState message={error} onRetry={reload} />;

  const currentImages = property.images;
  const currentStatus = statusValue ?? property.status;

  const handleSubmit = async (values: PropertyFormValues) => {
    await propertiesApi.update(propertyId, values);
    navigate(`/properties/${propertyId}`);
  };

  const handleStatusChange = async (next: PropertyStatus) => {
    setStatusSaving(true);
    setStatusError(null);
    try {
      await propertiesApi.update(propertyId, { status: next });
      setStatusValue(next);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Edit listing</h1>
          <p>Update details, manage photos, or change the listing status.</p>
        </div>
      </div>

      <div className="form-section">
        <h2>Status</h2>
        {statusError ? <div className="alert alert--error">{statusError}</div> : null}
        <div className="field">
          <label htmlFor="status-select">Listing status</label>
          <select
            id="status-select"
            value={currentStatus}
            disabled={statusSaving}
            onChange={(e) => handleStatusChange(e.target.value as PropertyStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ImageUploadManager propertyId={propertyId} images={currentImages} onChange={() => reload()} />

      <PropertyForm initial={property} submitLabel="Save changes" onSubmit={handleSubmit} />
    </div>
  );
}

export function EditPropertyPage() {
  const { id = "" } = useParams();
  return (
    <RequireAuth message="Sign in to edit this listing.">
      <EditPropertyForm propertyId={id} />
    </RequireAuth>
  );
}
