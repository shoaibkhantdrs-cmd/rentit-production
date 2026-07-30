import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 1400;
// Ticking on a fixed wall-clock interval (not requestAnimationFrame) is a
// deliberate choice, not an oversight: this app has already hit real
// production bugs (see Reveal.tsx's history) where rAF-driven and CSS-
// transition-driven animations silently stalled forever on a backgrounded/
// throttled tab with no way to recover. setInterval keeps firing (browsers
// only throttle it to a minimum ~1s cadence when hidden, never suspend it
// outright), and because each tick recomputes progress from elapsed
// wall-clock time rather than incrementing a fixed step, the count always
// converges to the right final value regardless of how many ticks were
// skipped or how throttled they were.
const TICK_MS = 40;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface AnimatedNumberProps {
  /** The real, final value to count up to -- never invent or round this
   * upstream just to make the animation "look nicer"; that would
   * contradict this app's existing "no invented figures" convention. */
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  /** Passed to Number.prototype.toLocaleString -- "en-IN" matches every
   * other number formatted on this page (e.g. the old stats section's
   * `.toLocaleString("en-IN")` on the listings total). */
  locale?: string;
}

/**
 * Count-up number, gated on the element actually entering the viewport
 * (no point animating something the user hasn't scrolled to yet) with a
 * setTimeout safety net in case the IntersectionObserver never fires --
 * same defensive pattern as Reveal.tsx. Respects
 * `prefers-reduced-motion: reduce` by skipping straight to the final
 * value with no animation at all.
 *
 * Accessibility: the animated digits are marked `aria-hidden` so a screen
 * reader doesn't announce every intermediate value mid-count; a second,
 * visually-hidden span carries the real final value once, which is what
 * assistive tech actually reads.
 */
export function AnimatedNumber({
  value,
  duration = DEFAULT_DURATION_MS,
  prefix = "",
  suffix = "",
  locale = "en-IN",
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    let intervalId: number | undefined;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const startTime = Date.now();
      intervalId = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setDisplay(Math.round(value * easeOutCubic(progress)));
        if (progress >= 1 && intervalId !== undefined) {
          window.clearInterval(intervalId);
        }
      }, TICK_MS);
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    const fallbackId = window.setTimeout(start, 1500);

    return () => {
      observer.disconnect();
      if (intervalId !== undefined) window.clearInterval(intervalId);
      window.clearTimeout(fallbackId);
    };
  }, [value, duration]);

  const formattedFinal = `${prefix}${value.toLocaleString(locale)}${suffix}`;
  const formattedDisplay = `${prefix}${display.toLocaleString(locale)}${suffix}`;

  return (
    <span ref={ref}>
      <span aria-hidden="true">{formattedDisplay}</span>
      <span className="sr-only">{formattedFinal}</span>
    </span>
  );
}
