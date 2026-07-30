import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Scroll-triggered fade-up wrapper for page sections (Home's category
 * strip, listing rails, trust section, stats, FAQ, etc.). Animates once
 * the section enters the viewport rather than all at once on page load,
 * which is what makes a long landing page feel alive as you scroll instead
 * of a single flat fade-in at the top.
 *
 * Bug fix history (homepage UI bug report -- stats section reported
 * permanently faded, twice):
 *
 * Round 1: this used to be a `framer-motion` `m.section` with
 * `initial={{ opacity: 0 }}` / `whileInView={{ opacity: 1 }}` /
 * `viewport={{ once: true }}`. Live inspection caught sections stuck with
 * an inline `opacity: 0` (or, for the hero, frozen mid-tween at a
 * fractional value) that never progressed. Swapped to a plain
 * IntersectionObserver + CSS `transition` on `opacity`, on the theory that
 * a class-toggle transition can't get stuck the way a JS tween can.
 *
 * Round 2: it got stuck again, in the same way, after the round-1 fix
 * shipped. Live-inspected again: the section's classList correctly had
 * `reveal-v2--visible`, but computed opacity was still `0` -- and even
 * forcibly setting `opacity: 1 !important` inline on the element via
 * DevTools/JS did NOT change the computed value. Per the CSS Cascade
 * spec, a *running* transition's interpolated value overrides every other
 * declaration for that property, including inline `!important` -- so
 * whatever stalled this transition left it with a stronger claim on
 * `opacity` than anything short of the transition itself completing or
 * being cancelled. There's no CSS-only escape hatch from that once it's
 * stuck.
 *
 * Actual fix: stop treating `opacity` as an animatable/hideable property
 * here at all. `.reveal-v2` now sets `opacity: 1` unconditionally in the
 * CSS (see index.css) -- content is never invisible, full stop, no matter
 * what this component's state does. Only `transform: translateY(...)` is
 * animated, which can never hide or block content even if its transition
 * stalls the exact same way; at worst a section sits a few px offset. The
 * IntersectionObserver + boolean state below is now purely a cosmetic
 * slide-in enhancement, not something anything else depends on for
 * visibility -- and the `setTimeout` safety net still guarantees the
 * slide-in itself resolves even if the observer never fires.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      // No IntersectionObserver support -- show content immediately rather
      // than gating it behind a feature that doesn't exist.
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px", threshold: 0 },
    );
    observer.observe(el);

    // Safety net: guarantee visibility even if the observer never fires.
    const fallback = window.setTimeout(() => setRevealed(true), 1500);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={["reveal-v2", revealed ? "reveal-v2--visible" : "", className].filter(Boolean).join(" ")}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </section>
  );
}
