import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, OfflineError } from "@/api/httpClient";

export type AsyncState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

/**
 * Runs an async data-fetch on mount (and whenever `deps` changes), tracking
 * loading/success/error state. Every list/detail page in this app follows
 * the same shape: show a skeleton while loading, the data on success, and
 * an ErrorState with a retry button on failure.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading", data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });

    fnRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError || err instanceof OfflineError
            ? err.message
            : "Something went wrong. Please try again.";
        setState({ status: "error", data: null, error: message });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return { ...state, reload };
}
