import { ReactNode } from "react";
import { m } from "framer-motion";

/**
 * Scroll-triggered fade-up wrapper for page sections (Home's category
 * strip, listing rails, trust section, stats, FAQ, etc.). Animates once
 * the section enters the viewport rather than all at once on page load,
 * which is what makes a long landing page feel alive as you scroll instead
 * of a single flat fade-in at the top.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <m.section
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
    >
      {children}
    </m.section>
  );
}
