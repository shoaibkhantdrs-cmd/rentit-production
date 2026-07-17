import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { notificationsApi } from "@/api/notifications";
import { AppNotification } from "@/api/types";
import { Popover } from "@/components/ui/Popover";
import { EmptyState } from "@/components/EmptyState";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/**
 * Real notification center backed by the existing /notifications API
 * (notificationsApi.list/markRead) -- this endpoint existed already but no
 * page or dropdown in the frontend actually surfaced it (only the separate
 * Preferences settings page did). Grouped into Today / Earlier, with a
 * genuine unread count fetched from the API's own total (not guessed).
 */
export function NotificationCenter() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    Promise.all([notificationsApi.list(1, 20), notificationsApi.list(1, 1, true)])
      .then(([all, unread]) => {
        setItems(all.items);
        setUnreadCount(unread.total);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    try {
      await notificationsApi.markRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // best-effort -- next open will reflect the real state either way
    }
  };

  const markOneRead = async (id: string) => {
    if (items.find((n) => n.id === id)?.readAt) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead([id]);
    } catch {
      // optimistic update stands -- a stale unread badge is a minor
      // inconsistency, not worth rolling back and flickering the UI for
    }
  };

  const today = items.filter((n) => isToday(n.createdAt));
  const earlier = items.filter((n) => !isToday(n.createdAt));

  return (
    <Popover
      align="right"
      width={340}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          className="nav-v2__icon-btn"
          onClick={toggle}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          aria-expanded={open}
        >
          <Bell size={19} />
          {unreadCount > 0 ? <span className="unread-badge unread-badge--nav">{unreadCount}</span> : null}
        </button>
      )}
    >
      {() => (
        <>
          <div className="notif-panel__header">
            Notifications
            {unreadCount > 0 ? (
              <button type="button" className="notif-panel__mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            ) : null}
          </div>

          {loaded && items.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState title="No notifications yet" description="We'll let you know when something needs your attention." />
            </div>
          ) : null}

          {today.length > 0 ? (
            <>
              <div className="notif-group-label">Today</div>
              {today.map((n) => (
                <NotificationRow key={n.id} notification={n} onRead={markOneRead} />
              ))}
            </>
          ) : null}

          {earlier.length > 0 ? (
            <>
              <div className="notif-group-label">Earlier</div>
              {earlier.map((n) => (
                <NotificationRow key={n.id} notification={n} onRead={markOneRead} />
              ))}
            </>
          ) : null}
        </>
      )}
    </Popover>
  );
}

function NotificationRow({ notification, onRead }: { notification: AppNotification; onRead: (id: string) => void }) {
  const unread = !notification.readAt;
  return (
    <div
      className={`notif-item${unread ? " notif-item--unread" : ""}`}
      onClick={() => unread && onRead(notification.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && unread) onRead(notification.id);
      }}
    >
      {unread ? <span className="notif-item__dot" aria-hidden="true" /> : <span style={{ width: 8 }} />}
      <div>
        <div className="notif-item__title">{notification.title}</div>
        <div className="notif-item__body">{notification.body}</div>
        <div className="notif-item__time">{timeAgo(notification.createdAt)}</div>
      </div>
    </div>
  );
}
