import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { StatusPill } from "@/components/admin/AdminWidgets";
import { UserStatus } from "@/api/types";

const PAGE_SIZE = 20;

export function UsersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);

  const { status: reqStatus, data, error, reload } = useAsync(
    () =>
      adminApi.searchUsers({
        query: query || undefined,
        status: status || undefined,
        role: role || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [query, status, role, page],
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Search, filter, and manage RentIt accounts.</p>
        </div>
      </div>

      <div className="admin-filter-bar">
        <input
          type="search"
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as UserStatus | "");
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <select
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value);
          }}
        >
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="property_owner">Property owner</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
      </div>

      {reqStatus === "loading" && <div className="skeleton" style={{ height: 320 }} />}
      {reqStatus === "error" && <ErrorState message={error} onRetry={reload} />}
      {reqStatus === "success" && data.items.length === 0 && (
        <EmptyState title="No users match these filters" />
      )}

      {reqStatus === "success" && data.items.length > 0 && (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Verified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <StatusPill status={user.status} />
                  </td>
                  <td>{user.roles.join(", ") || "—"}</td>
                  <td>
                    {user.emailVerified ? "📧" : ""} {user.phoneVerified ? "📱" : ""}{" "}
                    {user.identityVerified ? "🪪" : ""}
                  </td>
                  <td>
                    <Link to={`/admin/users/${user.id}`} className="btn btn--secondary btn--sm">
                      View
                    </Link>
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
