import { useState } from "react";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Pagination } from "@/components/Pagination";

function FavoritesList() {
  const [page, setPage] = useState(1);
  const { status, data, error, reload } = useAsync(() => propertiesApi.favorites(page, 20), [page]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Favorites</h1>
          <p>Properties you've saved for later.</p>
        </div>
      </div>

      {status === "loading" && <PropertyGridSkeleton count={6} />}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          title="No favorites yet"
          description="Save listings you're interested in and they'll show up here."
          action={
            <a href="/search" className="btn-v2 btn-v2--primary">
              Browse listings
            </a>
          }
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <>
          <div className="property-grid-v2">
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

export function FavoritesPage() {
  return (
    <RequireAuth message="Sign in to see your saved favorites.">
      <FavoritesList />
    </RequireAuth>
  );
}
