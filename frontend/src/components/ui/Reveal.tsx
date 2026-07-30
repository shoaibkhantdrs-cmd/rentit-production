import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Scroll-triggered fade-up wrapper for page sections (Home's category
 * strip, listing rails, trust section, stats, FAQ, etc.). Animates once
 * the section enters the viewport rather than all at once on page load,
 * which is what makes a long landing page feel alive as you scroll instead
 * of a single flat fade-in at the top.
 *
 * Bug fix (homepage UI bug report): this used to be a `framer-motion`
 * `m.section` with `initial={{ opacity: 0 }}` / `whileInView={{ opacity: 1 }}`
 * / `viewport={{ once: true }}`. Live inspection on the deployed site caught
 * sections (e.g. the stats block) stuck with an inline `opacity: 0` --
 * or, for the hero, frozen mid-tween at a fractional opacity like
 * `0.261993` -- that never progressed even seconds later. Root cause: a
 * JS-interpolated, rAF-driven tween has no guaranteed end state if a frame
 * is skipped or throttled (backgrounded tab, slow device, main thread busy
 * parsing the async framer-motion chunk while the section is already in
 * view). Because `viewport.once` was `true`, the IntersectionObserver
 * disconnects after that first, possibly-interrupted trigger, so a
 * section that got stuck could never recover -- exactly the "faded/
 * blurred and never clears" symptom reported (stats section, and by
 * extension anything below the fold).
 *
 * Fix: use a plain IntersectionObserver that only flips a boolean, and let
 * a CSS `transition` (compositor-driven, not JS-interpolated) handle the
 * visual fade. A class-toggle transition can't get stuck at a partial
 * value the way an imperative tween can -- even if the browser skips the
 * animated frames entirely (e.g. tab was hidden), the element's computed
 * end state is still the target value the instant the class is applied.
 * A `setTimeout` safety net also forces visibility if the observer never
 * fires at all (e.g. the element is already in view before this effect
 * runs), so content can never be left permanently invisible/inert.
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
