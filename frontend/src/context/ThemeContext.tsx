import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "auto";
export type Theme = "light" | "dark";

const STORAGE_KEY = "rentit.theme";

interface ThemeContextValue {
  /** What the user actually chose ("auto" included). */
  preference: ThemePreference;
  /** The resolved light/dark value actually applied to the page --
   * when preference is "auto" this tracks the OS setting live. */
  theme: Theme;
  setPreference: (pref: ThemePreference) => void;
  /** Convenience used by the existing admin toggle button -- cycles
   * light -> dark -> light (skips "auto"), unchanged behavior. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readInitialPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") return stored;
  } catch {
    // localStorage unavailable (e.g. private browsing) -- fall through.
  }
  return "auto";
}

/**
 * Real, working light/dark/auto theme, backed by a `data-theme` attribute
 * on <html>, which index.css's `[data-theme="dark"]` block overrides CSS
 * variables for (originally built for the admin panel in Phase 4, now
 * wired app-wide with a visible switcher in the main navbar). "Auto"
 * follows the OS `prefers-color-scheme` live via a matchMedia listener,
 * rather than just reading it once at load.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readInitialPreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(readSystemTheme);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme: Theme = preference === "auto" ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      window.localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Preference still applies for this session even if it can't persist.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(theme === "light" ? "dark" : "light");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook intentionally lives alongside its Provider; see Toast.tsx for the
// same documented tradeoff.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
