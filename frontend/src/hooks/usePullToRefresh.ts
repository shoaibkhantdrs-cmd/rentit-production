import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;

/**
 * Native-app-style pull-to-refresh, touch-only (desktop mouse users are
 * unaffected -- there's no mouse equivalent gesture here, matching how
 * every mobile app implements this). Only engages when the page is
 * already scrolled to the very top, so it never fights normal scrolling.
 * Listeners are attached once (refs hold the latest callback/values) to
 * avoid re-binding on every pixel of movement.
 */
export function usePullToRefresh(onRefresh: () => void | Promise<void>, disabled = false) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshingRef.current) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        distanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      if (e.cancelable) e.preventDefault();
      const next = Math.min(delta * 0.5, 100);
      distanceRef.current = next;
      setPullDistance(next);
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      startYRef.current = null;
      if (distanceRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        Promise.resolve(onRefreshRef.current()).finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
        });
      }
      distanceRef.current = 0;
      setPullDistance(0);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled]);

  return { pullDistance, refreshing };
}
