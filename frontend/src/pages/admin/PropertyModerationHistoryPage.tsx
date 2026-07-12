import { useState } from "react";
import { useParams } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { StatusPill } from "@/components/admin/AdminWidgets";

const PAGE_SIZE = 20;

/** Serves both "Moderation History" (Part 3) views: a single property's
 * history (route has an :id param) and the admin-wide recent-activity feed
 * (no :id) -- both are the same GetPropertyModerationHistoryUseCase on the
 * backend with propertyId present or omitted. */
export function PropertyModerationHistoryPage() {
  const { id } = useParams<{ id?: string }>();
  const [page, setPage] = useState(1);

  const { status, data, error, reload } = useAsync(
    () =>
      id
        ? adminApi.propertyModerationHistory(id, page, PAGE_SIZE)
        : adminApi.recentModerationActivity(page, PAGE_SIZE),
    [id, page],
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{id ? "Moderation history" : "Recent moderation activity"}</h1>
          <p>{id ? `Every status change for this listing.` : "Every status change across all listings."}</p>
        </div>
      </div>

      {status === "loading" && <div className="skeleton" style={{ height: 240 }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && data.items.length === 0 && <EmptyState title="No moderation history yet" />}

      {status === "success" && data.items.length > 0 && (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>From</th>
                <th>To</th>
                <th>Changed by</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{entry.previousStatus ? <StatusPill status={entry.previousStatus} /> : "—"}</td>
                  <td>
                    <StatusPill status={entry.newStatus} />
                  </td>
                  <td>{entry.changedBy ?? "system"}</td>
                  <td>{entry.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
