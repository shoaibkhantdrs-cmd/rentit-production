import { ReactNode, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface AccordionItemProps {
  id: string;
  title: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Controlled mode -- pass open/onToggle from a parent (e.g. SearchPage
   * filters, where only one section is allowed open at a time). Omit both
   * to let the item manage its own open state (e.g. the FAQ list). */
  open?: boolean;
  onToggle?: () => void;
}

export function AccordionItem({ title, icon, defaultOpen = false, children, open, onToggle }: AccordionItemProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const toggle = onToggle ?? (() => setUncontrolledOpen((v) => !v));

  return (
    <div className="accordion-item">
      <button type="button" className="accordion-item__header" onClick={toggle} aria-expanded={isOpen}>
        <span className="accordion-item__title">
          {icon}
          {title}
        </span>
        <m.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} />
        </m.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <m.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="accordion-item__body">{children}</div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Accordion({ children }: { children: ReactNode }) {
  return <div className="accordion">{children}</div>;
}
