/**
 * Real, localStorage-backed "recent searches" for the Search page -- no
 * backend endpoint exists for this (nor should one; it's a per-device UI
 * convenience), so it's stored client-side only. Each entry is the actual
 * query string a search was run with, plus a human-readable label built
 * from the same filter data the active-filter chips already use.
 */

const STORAGE_KEY = "rentit.recentSearches";
const MAX_ENTRIES = 8;

export interface RecentSearch {
  /** The URLSearchParams query string (no leading "?") that reproduces this search. */
  query: string;
  /** Human-readable summary, e.g. "2BHK, Pune, up to Rs 25,000". */
  label: string;
  at: string;
}

export function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string, label: string): RecentSearch[] {
  const existing = loadRecentSearches().filter((s) => s.query !== query);
  const next = [{ query, label, at: new Date().toISOString() }, ...existing].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / storage full -- recent searches just won't persist.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
