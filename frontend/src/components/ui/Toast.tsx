import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

/**
 * A small, real (not decorative) global toast system. Replaces several
 * places in the app that previously showed a success/error message inline
 * with a persistent <div className="alert">, which is easy to miss and
 * clutters the layout once dismissed manually. Toasts auto-dismiss after
 * 4s and can be dismissed early.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  // Perf fix: this was a fresh object literal every ToastProvider render
  // (which itself re-renders on every showToast() call), which defeated
  // PropertyCard's React.memo() app-wide -- favoriting one card on a
  // 20-card grid re-rendered all 20, since every consumer of this context
  // saw a "new" value on every toast shown anywhere on the page. showToast
  // itself is already a stable useCallback reference, so memoizing the
  // wrapper object is enough to make the value reference-stable across
  // re-renders that don't actually change it.
  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.variant];
            return (
              <m.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`toast toast--${t.variant}`}
              >
                <Icon size={18} />
                <span>{t.message}</span>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <X size={14} />
                </button>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// Hook intentionally lives alongside its Provider (same pattern used by
// every context in src/context/); splitting into a second file for Fast
// Refresh purity isn't worth the churn for a dev-only warning.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft rather than crash the app if a page renders outside the
    // provider during development -- toasts just become no-ops.
    return { showToast: () => {} };
  }
  return ctx;
}
