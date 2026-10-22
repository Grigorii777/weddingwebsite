# Plan — the admin panel, cache-first

Design: `docs/superpowers/specs/2026-10-22-admin-cache-first-design.md`.
Built on branch `offline-cache-first` in its own worktree (another agent is on
the honeymoon portal); merged to `main` when green.

1. **Rules in `public/sw.js`** — `readPlan`, `rscBudget`, `REVALIDATE_AFTER_MS`,
   `RSC_TIMEOUT_MS`; exported for Node. Tests first in
   `scripts/verify-offline.mts`.
2. **Worker** — `X-Saved-At` on stored data; `freshAfter` kept in the DATA cache
   and bumped by successful writes, outbox sends and `site-sw:fresh-after`;
   `networkThenCache` follows `readPlan` and posts `site-sw:fresh` to the asking
   page when a refresh changed the body; pages copy-first with silent refresh;
   photos copy-first; RSC with a budget; `/admin` falls back to the dashboard copy;
   old static code removed only after every page re-saved.
3. **Pass** — `passOrder(pages, lastPage, done)` in `src/lib/offline.ts` (tested);
   `saveForOffline` keeps progress in `localStorage`, resumes, sends
   `complete` only for an uninterrupted pass.
4. **Page side** — `useLiveRefresh` + live registry in `offlineStore`;
   `OfflineManager` handles `site-sw:fresh` (event or pill); dashboard registers.
5. **Pull-to-refresh** in `AdminShell` (new `PullToRefresh` component in
   `src/components/offline/`).
6. **Checks** — `check:types`, `lint`, `check:offline`, `build`.
7. **Docs** — CHANGELOG entry (next free version at merge), AGENTS.md convention
   9 note, README offline section if present.
8. **Merge** — rebase on `main`, re-run checks, push (that is the deploy).
