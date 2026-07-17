import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { StatusPill } from "@/components/admin/AdminWidgets";
import { ApiError } from "@/api/httpClient";

const ALL_ROLES = ["customer", "property_owner", "moderator", "admin", "super_admin"];

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { status, data, error, reload } = useAsync(() => adminApi.getUserProfile(id!), [id]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[] | null>(null);

  const activity = useAsync(() => adminApi.getUserActivity(id!, 1, 10), [id]);

  // RC1 bug fix: this always resolved (errors were caught, not rethrown),
  // so every `.then(() => ...)` chained onto a call below ran even when
  // the action had actually failed (e.g. "Delete account" would navigate
  // away as if the delete succeeded). Now resolves `false` on failure so
  // callers can check before proceeding.
  const runAction = async (fn: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
    setActionError(null);
    setActionMessage(null);
    setBusy(true);
    try {
      await fn();
      setActionMessage(successMessage);
      reload();
      return true;
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return <div className="skeleton" style={{ height: 300 }} />;
  if (status === "error") return <ErrorState message={error} onRetry={reload} />;

  const roles = selectedRoles ?? data.roles;

  const toggleRole = (role: string) => {
    const base = selectedRoles ?? data.roles;
    setSelectedRoles(base.includes(role) ? base.filter((r) => r !== role) : [...base, role]);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{data.name}</h1>
          <p>{data.email}</p>
        </div>
        <StatusPill status={data.status} />
      </div>

      {actionError ? <div className="alert alert--error">{actionError}</div> : null}
      {actionMessage ? <div className="alert alert--success">{actionMessage}</div> : null}

      <div className="admin-two-col">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <h2>Profile</h2>
          </div>
          <div className="admin-panel__body">
            <dl className="admin-detail-list">
              <dt>Phone</dt>
              <dd>{data.phone ?? "—"}</dd>
              <dt>Email verified</dt>
              <dd>{data.emailVerified ? "Yes" : "No"}</dd>
              <dt>Phone verified</dt>
              <dd>{data.phoneVerified ? "Yes" : "No"}</dd>
              <dt>Identity verified</dt>
              <dd>{data.identityVerified ? "Yes" : "No"}</dd>
              <dt>Listings</dt>
              <dd>{data.propertyCount}</dd>
              <dt>Joined</dt>
              <dd>{new Date(data.createdAt).toLocaleDateString()}</dd>
            </dl>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <h2>Account actions</h2>
          </div>
          <div className="admin-panel__body admin-action-row">
            <button
              className="btn btn--secondary btn--sm"
              disabled={busy || data.status === "active"}
              onClick={() => runAction(() => adminApi.updateUserStatus(data.id, "active"), "User activated.")}
            >
              Activate
            </button>
            <button
              className="btn btn--secondary btn--sm"
              disabled={busy || data.status === "suspended"}
              onClick={() => {
                const reason = window.prompt("Reason for suspending this user (optional):") ?? undefined;
                runAction(() => adminApi.updateUserStatus(data.id, "suspended", reason), "User suspended.");
              }}
            >
              Suspend
            </button>
            <button
              className="btn btn--danger btn--sm"
              disabled={busy || data.status === "banned"}
              onClick={() => {
                const reason = window.prompt("Reason for banning this user:") ?? undefined;
                runAction(() => adminApi.updateUserStatus(data.id, "banned", reason), "User banned.");
              }}
            >
              Ban
            </button>
            <button
              className="btn btn--secondary btn--sm"
              disabled={busy}
              onClick={() =>
                runAction(
                  () => adminApi.resetUserPassword(data.id),
                  "A password reset code has been sent to the user.",
                )
              }
            >
              Reset password
            </button>
            <button
              className="btn btn--danger btn--sm"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`Delete ${data.name}'s account? This cannot be undone.`)) return;
                runAction(() => adminApi.deleteUser(data.id), "User deleted.").then((ok) => {
                  if (ok) navigate("/admin/users");
                });
              }}
            >
              Delete account
            </button>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel__header">
          <h2>Roles</h2>
          {selectedRoles && (
            <button
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() =>
                runAction(() => adminApi.updateUserRoles(data.id, roles), "Roles updated.").then((ok) => {
                  if (ok) setSelectedRoles(null);
                })
              }
            >
              Save roles
            </button>
          )}
        </div>
        <div className="admin-panel__body checkbox-grid">
          {ALL_ROLES.map((role) => (
            <label className="checkbox-tile" key={role}>
              <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
              {role.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel__header">
          <h2>Recent activity</h2>
        </div>
        <div className="admin-panel__body">
          {activity.status === "loading" && <div className="skeleton skeleton--text" />}
          {activity.status === "error" && <ErrorState message={activity.error} onRetry={activity.reload} />}
          {activity.status === "success" && activity.data.items.length === 0 && <p className="field-hint">No activity recorded.</p>}
          {activity.status === "success" && activity.data.items.length > 0 && (
            <ul className="admin-activity-list">
              {activity.data.items.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.action}</span>
                  <time>{new Date(entry.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
