import { RefreshCw } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
}

/** Purely visual companion to usePullToRefresh -- a spinner that tracks
 * how far the user has pulled, then spins for real while `refreshing`. */
export function PullToRefreshIndicator({ pullDistance, refreshing }: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !refreshing) return null;
  const progress = Math.min(pullDistance / 70, 1);

  return (
    <div
      className="pull-refresh-indicator"
      style={{ height: refreshing ? 44 : pullDistance, opacity: refreshing ? 1 : progress }}
      role="status"
      aria-label={refreshing ? "Refreshing" : undefined}
    >
      <RefreshCw
        size={18}
        className={refreshing ? "pull-refresh-indicator__spin" : undefined}
        style={!refreshing ? { transform: `rotate(${progress * 360}deg)` } : undefined}
      />
    </div>
  );
}
