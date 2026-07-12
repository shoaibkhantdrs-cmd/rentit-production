import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { propertiesApi } from "@/api/properties";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyForm, PropertyFormValues } from "@/components/PropertyForm";
import { ImageUploadManager } from "@/components/ImageUploadManager";
import { PropertyDetail } from "@/api/types";

function AddPropertyForm() {
  const navigate = useNavigate();
  const [created, setCreated] = useState<PropertyDetail | null>(null);

  const handleSubmit = async (values: PropertyFormValues) => {
    const result = await propertiesApi.create(values);
    setCreated(result);
  };

  if (created) {
    return (
      <div>
        <div className="alert alert--success">
          Listing created as a draft. Add some photos, then publish it from your{" "}
          <a href="/my-properties">My Properties</a> page (edit the listing and set status to "published").
        </div>
        <ImageUploadManager
          propertyId={created.id}
          images={created.images}
          onChange={(images) => setCreated({ ...created, images })}
        />
        <button type="button" className="btn btn--primary" onClick={() => navigate(`/properties/${created.id}`)}>
          View listing
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>List a property</h1>
          <p>New listings start as a draft -- publish them once you're ready for tenants to find them.</p>
        </div>
      </div>
      <PropertyForm submitLabel="Create listing" onSubmit={handleSubmit} />
    </div>
  );
}

export function AddPropertyPage() {
  return (
    <RequireAuth message="Sign in to list a property.">
      <AddPropertyForm />
    </RequireAuth>
  );
}
