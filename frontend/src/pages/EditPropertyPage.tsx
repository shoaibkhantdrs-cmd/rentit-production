import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyForm, PropertyFormValues } from "@/components/PropertyForm";
import { ImageUploadManager } from "@/components/ImageUploadManager";
import { PropertyDetailSkeleton } from "@/components/Skeletons";
import { ErrorState } from "@/components/ErrorState";
import { PropertyStatus, UpdatablePropertyStatus } from "@/api/types";

// Bug fix: this dropdown listed every UpdatablePropertyStatus including
// "published", but UpdateProperty.usecase.ts (backend) has always thrown
// ForbiddenError("Only an admin can publish a listing. Submit it for
// review instead.") for any non-admin PATCHing status: "published" -- the
// same admin-only guard AddPropertyPage.tsx's Publish step was fixed to
// respect (see ADMIN_ROLES there). This page never got the matching fix:
// a non-admin owner could pick "Published" here, submit, and land on a
// raw, confusing 403 with no path forward. The backend also blocks *any*
// status change while the listing is currently "inactive" for non-admins
// (only an admin can reactivate one they hid), so that option is
// unreachable for a non-admin too once a listing is in that state.
const ADMIN_ROLES = ["admin", "super_admin"];

const ALL_STATUS_OPTIONS: UpdatablePropertyStatus[] = [
  "draft",
  "pending_review",
  "published",
  "rented",
  "inactive",
  "removed",
];

const OWNER_STATUS_OPTIONS: UpdatablePropertyStatus[] = ALL_STATUS_OPTIONS.filter(
  (s) => s !== "published",
);

function EditPropertyForm({ propertyId }: { propertyId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.roles.some((role) => ADMIN_ROLES.includes(role)) ?? false;
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
  // Backend blocks every non-admin status change while currently
  // "inactive" (regardless of target), not just publish -- see
  // UpdateProperty.usecase.ts. Lock the control entirely in that case
  // instead of letting the user pick any option and hit a 403.
  const lockedInactive = !isAdmin && currentStatus === "inactive";
  // A non-admin's listing can already legitimately BE "published" (an
  // admin approved it) -- OWNER_STATUS_OPTIONS excludes "published" only
  // to stop a non-admin from transitioning *into* it, which would 403.
  // Re-add it here purely so the <select>'s controlled value matches a
  // real <option> and displays correctly; it's never present as a
  // reachable option when the current status is anything else, so this
  // can't be used to reach "published" from a non-published state.
  const statusOptions = isAdmin
    ? ALL_STATUS_OPTIONS
    : currentStatus === "published"
      ? [...OWNER_STATUS_OPTIONS, "published" as UpdatablePropertyStatus]
      : OWNER_STATUS_OPTIONS;

  const handleSubmit = async (values: PropertyFormValues) => {
    await propertiesApi.update(propertyId, values);
    navigate(`/properties/${propertyId}`);
  };

  const handleStatusChange = async (next: UpdatablePropertyStatus) => {
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
        {!isAdmin && currentStatus === "draft" ? (
          <p className="field-hint">
            New listings go live after a quick admin review -- switch this to "pending review" and
            we'll notify you the moment it's published.
          </p>
        ) : null}
        {lockedInactive ? (
          <p className="field-hint">
            This listing was hidden by an admin and can't be reactivated here. Contact support if you
            believe this is a mistake.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="status-select">Listing status</label>
          <select
            id="status-select"
            value={currentStatus}
            disabled={statusSaving || lockedInactive}
            onChange={(e) => handleStatusChange(e.target.value as UpdatablePropertyStatus)}
          >
            {statusOptions.map((s) => (
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
