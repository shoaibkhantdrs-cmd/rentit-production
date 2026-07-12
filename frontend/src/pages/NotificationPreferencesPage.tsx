import { useState } from "react";
import { notificationsApi } from "@/api/notifications";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";
import { NotificationCategoryPreferences, NotificationPreferences } from "@/api/types";

const CATEGORY_LABELS: Record<keyof NotificationCategoryPreferences, { label: string; hint: string }> = {
  newProperties: { label: "New property alerts", hint: "Listings that match your saved searches." },
  newMessages: { label: "New messages", hint: "When someone messages you in chat." },
  favoriteUpdates: { label: "Favorite property updates", hint: "Changes to properties you've favorited." },
  adminAnnouncements: { label: "Admin announcements", hint: "Platform-wide announcements from RentIt." },
};

function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const persist = async (next: NotificationPreferences) => {
    setPrefs(next);
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await notificationsApi.updatePreferences(next);
      setPrefs(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save your preferences.");
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (key: "notifyEmail" | "notifySms" | "notifyPush") => {
    void persist({ ...prefs, [key]: !prefs[key] });
  };

  const toggleCategory = (key: keyof NotificationCategoryPreferences) => {
    void persist({ ...prefs, categories: { ...prefs.categories, [key]: !prefs.categories[key] } });
  };

  return (
    <div>
      <div className="form-section">
        <h2 style={{ marginTop: 0 }}>Channels</h2>
        <p className="field-hint">How we can reach you.</p>
        <label className="preference-row">
          <div>
            <div>Email</div>
            <div className="field-hint">OTPs, welcome email, and approvals always send regardless of this toggle.</div>
          </div>
          <input type="checkbox" checked={prefs.notifyEmail} disabled={saving} onChange={() => toggleChannel("notifyEmail")} />
        </label>
        <label className="preference-row">
          <div>
            <div>SMS</div>
            <div className="field-hint">Text message alerts, where a phone number is on file.</div>
          </div>
          <input type="checkbox" checked={prefs.notifySms} disabled={saving} onChange={() => toggleChannel("notifySms")} />
        </label>
        <label className="preference-row">
          <div>
            <div>Push notifications</div>
            <div className="field-hint">Requires a device registered for push (mobile app).</div>
          </div>
          <input type="checkbox" checked={prefs.notifyPush} disabled={saving} onChange={() => toggleChannel("notifyPush")} />
        </label>
      </div>

      <div className="form-section">
        <h2 style={{ marginTop: 0 }}>What to notify me about</h2>
        {(Object.keys(CATEGORY_LABELS) as (keyof NotificationCategoryPreferences)[]).map((key) => (
          <label key={key} className="preference-row">
            <div>
              <div>{CATEGORY_LABELS[key].label}</div>
              <div className="field-hint">{CATEGORY_LABELS[key].hint}</div>
            </div>
            <input
              type="checkbox"
              checked={prefs.categories[key]}
              disabled={saving}
              onChange={() => toggleCategory(key)}
            />
          </label>
        ))}
      </div>

      {saveError ? <div className="alert alert--error">{saveError}</div> : null}
      {saved && !saveError ? <div className="alert alert--success">Preferences saved.</div> : null}
    </div>
  );
}

function NotificationPreferencesContent() {
  const { status, data, error, reload } = useAsync(() => notificationsApi.getPreferences(), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notification preferences</h1>
          <p>Choose how and when RentIt notifies you.</p>
        </div>
      </div>

      {status === "loading" && (
        <div className="form-section" aria-hidden="true">
          <div className="skeleton skeleton--text" />
          <div className="skeleton skeleton--text" style={{ width: "60%" }} />
        </div>
      )}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && <PreferencesForm initial={data} />}
    </div>
  );
}

export function NotificationPreferencesPage() {
  return (
    <RequireAuth message="Sign in to manage notification preferences.">
      <NotificationPreferencesContent />
    </RequireAuth>
  );
}
