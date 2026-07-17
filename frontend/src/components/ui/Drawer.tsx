import { MouseEvent, ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "left" slides in from the left (used for mobile filters); "bottom"
   * slides up from the bottom (used for mobile action sheets). */
  side?: "left" | "bottom";
}

/**
 * Slide-in panel used for the mobile filter sheet on Search (replacing the
 * Phase 1 version that just toggled a fixed-position sidebar's display).
 */
export function Drawer({ open, onClose, title, children, side = "left" }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const offscreen = side === "left" ? { x: "-100%" } : { y: "100%" };
  const onscreen = side === "left" ? { x: 0 } : { y: 0 };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <m.div
          className="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`drawer-panel drawer-panel--${side}`}
            initial={offscreen}
            animate={onscreen}
            exit={offscreen}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <div className="drawer-panel__header">
              {title ? <h3>{title}</h3> : <span />}
              <button type="button" className="icon-action" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="drawer-panel__body">{children}</div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
