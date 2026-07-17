import { ReactNode, useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";

interface PopoverProps {
  trigger: (args: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
}

/**
 * Anchored floating panel -- the shared positioning primitive behind the
 * profile menu, notification center, and any future dropdown. Renders
 * inline (not portaled) since every current use site sits inside the
 * sticky navbar, which is never clipped by an ancestor's overflow.
 */
export function Popover({ trigger, children, align = "right", width = 320 }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      {trigger({ open, toggle })}
      <AnimatePresence>
        {open ? (
          <>
            <div className="popover-catcher" onClick={close} aria-hidden="true" />
            <m.div
              role="menu"
              className="popover-panel"
              style={{ [align]: 0, width }}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              {children(close)}
            </m.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
