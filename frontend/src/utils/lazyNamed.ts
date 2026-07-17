import { ComponentType, lazy } from "react";

/**
 * Every page in this app uses a named export (`export function XPage()`),
 * not a default export -- React.lazy() requires a default export, so this
 * wraps the common `.then(m => ({ default: m.Name }))` boilerplate in one
 * place. Used to code-split the admin section (Phase 6 Part 3:
 * performance) without changing how every page file exports its
 * component. Loosely typed on purpose: it's a thin adapter over dynamic
 * `import()`, not part of the app's business logic.
 *
 * Regression fix (RC1 QA): `T` defaults to `ComponentType<any>`, so every
 * existing no-prop call site (every route in App.tsx) is unaffected -- but
 * a call site that passes real props can now supply `T` explicitly (e.g.
 * `lazyNamed<typeof ResultsMap>(...)`) to get correct prop-type inference
 * instead of collapsing to `IntrinsicAttributes` (which silently rejected
 * `items` on `<ResultsMap items={...} />` after that component was
 * converted to lazyNamed).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyNamed<T extends ComponentType<any> = ComponentType<any>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importFn: () => Promise<any>,
  exportName: string,
): T {
  return lazy(() =>
    importFn().then((module) => ({ default: module[exportName] })),
  ) as unknown as T;
}
