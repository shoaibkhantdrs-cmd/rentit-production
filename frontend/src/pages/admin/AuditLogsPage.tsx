import { useState } from "react";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { ApiError } from "@/api/httpClient";

const PAGE_SIZE = 25;

export function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const filters = {
    action: action || undefined,
    entityType: entityType || undefined,
    userId: userId || undefined,
  };

  const { status, data, error, reload } = useAsync(
    () => adminApi.searchAuditLogs({ ...filters, page, pageSize: PAGE_SIZE }),
    [action, entityType, userId, page],
  );

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await adminApi.downloadAuditLogsCsv(filters);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit logs</h1>
          <p>Every admin action, searchable and exportable.</p>
        </div>
        <button className="btn btn--secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {exportError ? <div className="alert alert--error">{exportError}</div> : null}

      <div className="admin-filter-bar">
        <input
          placeholder="Action (e.g. admin.property.approved)"
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
        />
        <input
          placeholder="Entity type (e.g. property)"
          value={entityType}
          onChange={(e) => {
            setPage(1);
            setEntityType(e.target.value);
          }}
        />
        <input
          placeholder="Actor user ID"
          value={userId}
          onChange={(e) => {
            setPage(1);
            setUserId(e.target.value);
          }}
        />
      </div>

      {status === "loading" && <div className="skeleton" style={{ height: 320 }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && data.items.length === 0 && <EmptyState title="No audit log entries match" />}

      {status === "success" && data.items.length > 0 && (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{entry.userId ?? "system"}</td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>
                    {entry.entityType ? `${entry.entityType}${entry.entityId ? `:${entry.entityId}` : ""}` : "—"}
                  </td>
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
