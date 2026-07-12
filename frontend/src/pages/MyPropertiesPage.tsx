import { useState } from "react";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Pagination } from "@/components/Pagination";

function MyPropertiesList() {
  const [page, setPage] = useState(1);
  const { status, data, error, reload } = useAsync(() => propertiesApi.mine(page, 20), [page]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My properties</h1>
          <p>Everything you've listed on RentIt, including drafts.</p>
        </div>
        <a href="/properties/new" className="btn btn--primary">
          List a new property
        </a>
      </div>

      {status === "loading" && <PropertyGridSkeleton count={6} />}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          title="You haven't listed any properties yet"
          description="Create your first listing to start reaching renters."
          action={
            <a href="/properties/new" className="btn btn--primary">
              List a property
            </a>
          }
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <>
          <div className="property-grid">
            {data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export function MyPropertiesPage() {
  return (
    <RequireAuth message="Sign in to see the properties you've listed.">
      <MyPropertiesList />
    </RequireAuth>
  );
}
