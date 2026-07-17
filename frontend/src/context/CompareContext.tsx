import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

const MAX_COMPARE = 3;

interface CompareContextValue {
  ids: string[];
  isComparing: (id: string) => boolean;
  toggleCompare: (id: string) => void;
  canAddMore: boolean;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * New, lightweight, real (not mocked) client-side "Compare" feature -- up
 * to 3 property IDs held in memory. No backend involvement at all: the
 * comparison page (CompareBar -> /compare) fetches each property's real
 * detail via the existing `propertiesApi.getById`, so this only adds
 * frontend state, nothing server-side.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);

  const isComparing = useCallback((id: string) => ids.includes(id), [ids]);

  const toggleCompare = useCallback((id: string) => {
    setIds((current) => {
      if (current.includes(id)) return current.filter((existing) => existing !== id);
      if (current.length >= MAX_COMPARE) return current;
      return [...current, id];
    });
  }, []);

  const clear = useCallback(() => setIds([]), []);

  const value = useMemo<CompareContextValue>(
    () => ({ ids, isComparing, toggleCompare, canAddMore: ids.length < MAX_COMPARE, clear }),
    [ids, isComparing, toggleCompare, clear],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

// Hook intentionally lives alongside its Provider; see Toast.tsx for the
// same documented tradeoff.
// eslint-disable-next-line react-refresh/only-export-components
export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within a CompareProvider");
  return ctx;
}
