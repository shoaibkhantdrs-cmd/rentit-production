# RentIt — Dependency (CVE) Audit

Read-only audit of `backend/package.json` and `frontend/package.json`, cross-referenced against each package's **resolved, actually-installed version** in `package-lock.json` (not just the declared `^range`, since that's what really ships) and current CVE/GHSA advisory data. A live `npm audit` could not be run — this sandbox has no registry access (`npm audit` returned `403 Forbidden — blocked by network allowlist`) — so this is the static equivalent, verified against public advisory databases via web search rather than guessed from memory.

## Bottom line

One package has real, current, high-severity CVEs that directly affect the exact version this project has installed: **multer**. Two other findings are worth awareness but are lower urgency: a disputed Leaflet CVE that doesn't apply to how this codebase actually uses the library, and a Cloudinary CVE that the currently-*installed* version already happens to be patched against, but whose declared `package.json` floor technically allows an older, vulnerable version. Everything else checked — Express, pg, cors, helmet, zod, bcrypt, vite, react-router-dom, dotenv, pino — is either clean or already patched at the resolved version.

Two packages the user asked about, **`jsonwebtoken`** and **`ws`**, are **not dependencies of this project at all** — see the note in the table below for why that's actually a deliberate, security-relevant design choice already documented in this project's prior security audit.

## Findings, ranked by severity

### 1. HIGH — `multer` 1.4.5-lts.2 (resolved/installed) is vulnerable to three 2025 DoS CVEs

- **Declared:** `^1.4.5-lts.1` (`backend/package.json:35`) — **Resolved/installed:** `1.4.5-lts.2` (`backend/package-lock.json`)
- **CVE-2025-47944** (GHSA-4pg4-qvpc-4q3h, CVSS 7.5/High): a malformed multipart upload request triggers an unhandled exception and crashes the Node process. Affects versions `1.4.4-lts.1` through `1.4.5-lts.2` — this project's exact installed version is inside the affected range.
- **CVE-2025-48997** (GHSA-g5hg-p3ph-g8qg): DoS via an upload with an empty-string field name. Affects `>=1.4.4-lts.1, <2.0.1` — also includes the installed version.
- **CVE-2025-47935** (GHSA-44fp-w29j-9vj5): memory/file-descriptor leak from unclosed streams when the request errors mid-upload. Affects `<2.0.0` — also includes the installed version.
- **Fix:** all three are only resolved by upgrading to the `2.x` line (`2.0.2`+ for the first). There is no `1.x` patch release and no documented workaround.
- **Why this matters here specifically:** this app has three real multipart upload endpoints that take untrusted input from any authenticated user — property photo upload, identity-verification document upload, and chat image attachments (all confirmed in the prior security audit as going through this exact `multer` middleware). Any of these three CVEs gives an authenticated user a way to crash or degrade the backend process with a single crafted request.

### 2. LOW / INFORMATIONAL — `cloudinary` — installed version is patched, but the declared range floor isn't

- **Declared:** `^2.4.0` (`backend/package.json:29`) — **Resolved/installed:** `2.10.0`
- **CVE-2025-12613** (GHSA-g4mf-96x5-5m2c, CVSS 8.6-8.8/High): Arbitrary Argument Injection in the Cloudinary Node SDK via parameter values containing an ampersand. Affects versions `<2.7.0`, fixed in `2.7.0`+.
- The version actually resolved and installed here, `2.10.0`, is **already past the fix version** — not currently exploitable in this install. Flagging as informational because the declared floor (`^2.4.0`) technically permits npm to resolve down to a vulnerable `2.4.x`–`2.6.x` release if the lockfile is ever regenerated without preserving the current resolution (e.g. `rm package-lock.json && npm install` against an old cache, or a CI pipeline that doesn't commit/restore the lockfile). Worth bumping the floor in `package.json` to `^2.7.0` or higher so the *declared* range itself can't resolve to a vulnerable version, not just the currently-committed lockfile.

### 3. LOW / INFORMATIONAL — `leaflet` — CVE is disputed by the maintainers, and doesn't apply to how this codebase uses it

- **Declared:** `^1.9.4` (`frontend/package.json:31`) — not installed in this sandbox (network-restricted), so the resolved version couldn't be confirmed from a lockfile; likely resolves to `1.9.4` or a close patch, since no newer minor has been released per the search results.
- **CVE-2025-69993** (GHSA-h5cx-hfj5-x8v3): Leaflet's `bindPopup()` renders its string argument as raw HTML with no sanitization, which is a stored-XSS vector *if* an application passes attacker-controlled text into it. The Leaflet maintainers have publicly disputed this being a library-level vulnerability at all, stating `bindPopup()`/`bindTooltip()`/`setContent()` are documented to accept and render an HTML string, a DOM element, or a function — by design — and that sanitizing untrusted input before passing it in is the calling application's responsibility, not the library's.
- **Verified against this codebase's actual usage:** `frontend/src/components/ResultsMap.tsx` uses `react-leaflet`'s React-component-based `<Popup>` (JSX children — `{item.title}`, `{formatCurrency(...)}`), not Leaflet's raw string-based `bindPopup(htmlString)` API. React's normal JSX interpolation auto-escapes those values. This codebase never calls the vulnerable raw API path at all, so this CVE — disputed or not — doesn't apply to how the app is actually built. Flagging as informational for completeness since the user asked for "every match."

## Confirmed clean / already patched (checked, no action needed)

| Package | Declared | Resolved (installed) | Status |
|---|---|---|---|
| `express` | `^4.19.2` | `4.22.2` | Patched against every 2024 Express CVE found (open redirect CVE-2024-29041 fixed in 4.19.2, XSS-in-redirect CVE-2024-43796 fixed in 4.20.0, path-to-regexp ReDoS CVE-2024-45296 fixed in 4.21.2, response.links injection CVE-2024-10491) — 4.22.2 postdates all of them. |
| `vite` | `^5.4.2` | `5.4.21` | The Vite dev-server CVEs found in 2025 (CVE-2025-31125, fixed in 5.4.16; CVE-2025-58752, fixed in 5.4.20) are both already patched at 5.4.21. Note these CVEs only ever affected apps that explicitly exposed the Vite dev/preview server to the network (`--host`) — this project's `preview` script does use `--host`, worth confirming that's dev/staging-only and the real production deploy serves the static `dist/` build through a real web server, not `vite preview`. |
| `react-router-dom` | `^6.26.1` | `6.30.4` | The React Router CVEs found in late 2025/2026 (pre-render data spoofing, SSR meta() XSS, the RSC-related RCE cluster) all require React Router v7's **Framework Mode** (SSR) or React Server Components. This app uses `react-router-dom` v6 in plain client-side routing mode (Vite SPA, no SSR, no RSC) — none of those attack surfaces exist here. |
| `pg` | `^8.12.0` | `8.22.0` | No CVEs found for the `pg` (node-postgres) npm client library itself. (Search results surfaced CVEs for the *unrelated* `pg-promise` package and for the PostgreSQL server/`psql`/`pg_dump` binaries — neither applies to this Node client library or to how this app talks to its database.) |
| `bcrypt` | `^5.1.1` | `5.1.1` | No current CVE found against the package itself. The only related advisory is a historical, moderate-severity `semver` ReDoS in `node-gyp`'s toolchain (used only to compile the native binding at install time) — not a runtime app vulnerability. |
| `cors` | `^2.8.5` | `2.8.6` | No CVEs found. |
| `helmet` | `^7.1.0` | `7.2.0` | No CVEs found. |
| `zod` | `^3.23.8` | `3.25.76` | No CVEs found. |
| `dotenv` | `^16.4.5` | `16.6.1` | No CVEs found. |
| `pino` / `pino-http` | `^9.3.2` / `^10.2.0` | `9.14.0` / `10.5.0` | No CVEs found. |
| `express-rate-limit` | `^7.4.0` | `7.5.1` | No CVEs found. |
| `node-pg-migrate` | `^7.6.1` | `7.9.1` | Dev-only (migration CLI, never runs in the deployed server process). No CVEs found. |
| `react` / `react-dom` | `^18.3.1` | `18.3.1` | No CVEs found for React 18 itself. (The RSC/React-Server-Components CVE cluster found during this audit is React 19-specific and requires a server-rendering framework — not applicable to this app's plain client-side React 18 SPA.) |
| `@capacitor/core` / `android` / `ios` / `cli` | `^6.1.2` | `6.2.1` | No current CVE against Capacitor 6.x core itself. Older advisories found (CVE-2022-22912/25883) are from Capacitor's early 0.x line, not applicable. Historically, `@capacitor/cli`/`@capacitor/assets` have pulled in vulnerable transitive `xml2js`/`@xmldom/xmldom` versions (prototype pollution) — worth a `npm ls xml2js` check before a native build, but this is dev-only native-tooling surface, never shipped to the web bundle or the production API (confirmed in the prior bundle-size audit: zero `@capacitor/*` imports exist anywhere in `frontend/src`). |
| `lucide-react`, `framer-motion` | `^0.446.0`, `^11.5.4` | not installed in this sandbox to confirm resolved version | No CVEs found for either package in current advisory databases. |

## Packages the user asked about that aren't actually dependencies

| Package | Status |
|---|---|
| `jsonwebtoken` | **Not a dependency anywhere in this project.** JWT signing/verification is hand-rolled in `backend/src/infrastructure/security/JwtTokenService.ts` using Node's built-in `crypto` module (HMAC-SHA256, `timingSafeEqual`) — confirmed in the prior security audit. This sidesteps the entire historical CVE surface of the `jsonwebtoken` package (which has had real algorithm-confusion and signature-verification bypass CVEs over the years) at the cost of maintaining that logic in-house. Worth knowing either way, not a gap to fill. |
| `ws` | **Not a dependency.** The realtime chat layer (`backend/src/infrastructure/realtime/WebSocketGateway.ts`) isn't backed by the standalone `ws` npm package in this project's dependency list — no separate WebSocket library CVE surface to track here. |

## Suggested remediation order

1. Upgrade `multer` to `2.x` (`2.0.2`+) in `backend/package.json` and re-test the three upload flows (property photos, verification documents, chat attachments) against the new major version's API — this is the one finding with real, current, unauthenticated-severity impact on a live endpoint.
2. Bump the declared `cloudinary` floor from `^2.4.0` to `^2.7.0` (or higher) so the *range itself* can't resolve to a vulnerable version, independent of what the current lockfile happens to have pinned.
3. No action required for Leaflet given the confirmed-safe usage pattern, but worth a one-line comment in `ResultsMap.tsx` noting *why* it's safe (React-component `<Popup>`, never raw `bindPopup(string)`), so a future contributor doesn't introduce the vulnerable pattern without realizing it.
4. Confirm the production deployment serves `frontend/dist/` through a real static-file server / reverse proxy rather than `vite preview --host`, since that script's `--host` flag is the specific condition under which the (already-patched-at-this-version, but worth double-checking at deploy time) Vite dev/preview-server CVEs would matter at all.

Sources:
- [CVE-2025-47944: Multer vulnerable to Denial of Service](https://github.com/expressjs/multer/security/advisories/GHSA-4pg4-qvpc-4q3h)
- [CVE-2025-48997: Multer Upload Empty Field DoS](https://www.miggo.io/vulnerability-database/cve/CVE-2025-48997)
- [CVE-2025-47935: Multer Stream Resource Leak DoS](https://github.com/expressjs/multer/security/advisories/GHSA-44fp-w29j-9vj5)
- [Express.js Security updates](https://expressjs.com/en/advanced/security-updates/)
- [CVE-2025-31125: Vite Dev Server fs.deny Bypass](https://www.miggo.io/vulnerability-database/cve/CVE-2025-31125)
- [CVE-2025-58752 Detail - NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58752)
- [Statement on CVE-2025-69993 (XSS via bindPopup) · Leaflet/Leaflet](https://github.com/Leaflet/Leaflet/issues/10214)
- [CVE-2025-12613: Cloudinary Node SDK Arbitrary Argument Injection](https://github.com/advisories/GHSA-g4mf-96x5-5m2c)
- [React Router Flaws Expose Servers to RCE, XSS, and DoS](https://www.mallory.ai/stories/019e8a95-0699-736b-abc4-0c7003f95d47)
