import { FormEvent, useState } from "react";
import { adminApi } from "@/api/admin";
import { ApiError } from "@/api/httpClient";
import { UserStatus } from "@/api/types";

/**
 * "Admin Notifications" + "Broadcast Notifications" (Phase 4 Part 6). This
 * composer is the broadcast half; each admin's own system notifications
 * (e.g. "a new report was filed") reuse the existing Phase 2
 * GET/PATCH /notifications endpoints the main app's navbar already
 * surfaces -- no separate admin inbox UI needed for those.
 */
export function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("active");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ recipientCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Send this broadcast now? This cannot be undone.")) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminApi.broadcastNotification({
        title: title.trim(),
        body: body.trim(),
        audience: { role: role || undefined, status: status || undefined },
      });
      setResult(res);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the broadcast.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>Send a broadcast notification to a segment of users.</p>
        </div>
      </div>

      <section className="admin-panel" style={{ maxWidth: 560 }}>
        <div className="admin-panel__header">
          <h2>Compose broadcast</h2>
        </div>
        <div className="admin-panel__body">
          {error ? <div className="alert alert--error">{error}</div> : null}
          {result ? (
            <div className="alert alert--success">
              Sent to {result.recipientCount} recipient{result.recipientCount === 1 ? "" : "s"}.
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="bc-title">Title</label>
              <input id="bc-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bc-body">Message</label>
              <textarea id="bc-body" required maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="bc-status">Audience status</label>
                <select id="bc-status" value={status} onChange={(e) => setStatus(e.target.value as UserStatus | "")}>
                  <option value="active">Active users</option>
                  <option value="suspended">Suspended users</option>
                  <option value="banned">Banned users</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="bc-role">Limit to role (optional)</label>
                <select id="bc-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Everyone</option>
                  <option value="customer">Customers</option>
                  <option value="property_owner">Property owners</option>
                  <option value="moderator">Moderators</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>
            <p className="field-hint">
              Delivered as an in-app notification to every matching user, plus a push notification via the
              configured push service (console-logged in this environment -- see docs/phase-4.md).
            </p>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Sending..." : "Send broadcast"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
