import { ReactNode } from "react";
import { m } from "framer-motion";
import { SearchX } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Secondary action rendered next to `action` -- e.g. "Browse Categories"
   * alongside a primary "Clear Filters" button. */
  secondaryAction?: ReactNode;
}

/** Premium empty state -- same prop shape as before (existing callers that
 * pass an emoji string for `icon` keep working unchanged, since `ReactNode`
 * accepts strings), just restyled with the redesign's circular icon badge
 * and up to two actions instead of one. */
export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <m.div
      className="empty-state-v2"
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <m.div
        className="empty-state-v2__illustration"
        aria-hidden="true"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05, type: "spring", stiffness: 260, damping: 20 }}
      >
        {icon ?? <SearchX size={44} strokeWidth={1.5} />}
      </m.div>
      <h3 className="empty-state-v2__title">{title}</h3>
      {description ? <p className="empty-state-v2__description">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="empty-state-v2__actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </m.div>
  );
}
