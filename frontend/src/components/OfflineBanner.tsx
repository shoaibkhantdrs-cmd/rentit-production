import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Phase 5 Part 8 ("Offline handling"). A persistent, unmissable but
 * non-blocking banner -- doesn't stop the user from browsing whatever's
 * already loaded/cached, just sets expectations that new data won't load
 * until the connection is back. */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status">
      You're offline. Some actions won't work until your connection is back.
    </div>
  );
}
