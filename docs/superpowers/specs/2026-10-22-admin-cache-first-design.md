# The admin panel, cache-first

**Date:** 2026-10-22
**Status:** approved in chat — "I want to scope the entire admin panel to do it… then create a plan, then build it."

## Intent

The installed admin app should behave like Mail: tapping the icon shows what is
on the phone at once, signal or not; the server is asked in the background and
newer data appears when it arrives; a refresh with no signal says so and leaves
everything usable.

Austin's words: "It's slow to open and navigate, sometimes it won't open if
offline and opening it from a closed state."

## What is wrong today (found in the code)

1. **Every read is network-first.** A page and each of its data requests wait up
   to 2.5 s for the server before the saved copy answers (`readThrough` in
   `public/sw.js`). On a phone that is every open and every tab change.
2. **Client navigation skips the worker.** Next's RSC requests are network-only
   with no time limit, so a tap between admin pages on a hanging signal hangs.
3. **The save pass rarely finishes on a phone.** It opens ~49 pages, one at a
   time, in a hidden frame (2.5–15 s each). iOS suspends it when the app is left,
   and every run starts from the top, so the later pages' data is never saved —
   those pages open offline to "failed to load".
4. **Old code is deleted too early.** A full save drops the previous build's code
   before re-saving the pages; a page whose re-save failed still points at the
   deleted code and opens blank offline.

## Goals

- Admin pages and their data answer from the saved copy **immediately** when one
  exists, and are refreshed behind the scenes.
- A page that has seen newer data says so: the honeymoon portal and the dashboard
  update in place; any other page shows a small **Updated · Refresh** pill (never
  silently replacing a form someone is typing in).
- Moving between pages never waits long on a bad signal.
- Opening from fully closed with no signal always opens the app.
- **Pull down at the top of an admin page to refresh**: with a connection it
  reloads from the server; without one it says "Couldn't connect" and nothing
  else changes.
- Photos: keep the ones the site shows (public pages, wedding party, admin pages
  that show them, honeymoon, travel documents); never download the unused
  uploads in the photo library. (Already true — keep it true.)

## Non-goals

- Background refresh while the app is closed — iOS does not allow it.
- Changing the outbox, its replay, or the honeymoon offline overlay.
- Caching other sites' content beyond what is kept today.
- Public pages change only because they share the worker; the guest-facing
  behaviour (only what you visit is saved, in a browser tab) is unchanged.

## Anti-goals

- **Showing a stale copy right after you saved something.** A page that saves and
  then reloads its list must see its own change.
- Replacing a form's contents under someone's fingers.
- Saving the photo library.

## Design

### Reads: the copy first, the server behind it

A pure rule, `readPlan({ hasSaved, savedAt, freshAfter, offlineAt, now })`:

| Situation | Plan |
|---|---|
| No saved copy | `network` — as today (6 s, then fail) |
| Copy saved before `freshAfter` (a write, or a pull-to-refresh, happened since) | `network-first` — today's `readThrough` |
| Offline hold active | `copy` — answer now, no refresh, probe |
| Copy saved in the last 15 s | `copy` — answer now, no refresh (a page that asks twice in a row costs one request) |
| Otherwise | `copy+refresh` — answer now, fetch behind it, store the answer |

- Every stored data copy carries an `X-Saved-At` header.
- `freshAfter` is bumped by every write that reaches the server (direct or from
  the outbox) and by pull-to-refresh, and is kept in the cache so a worker that
  iOS restarted still knows it.
- Data refresh compares the new body with the copy that was served; if it
  differs, the worker tells **that page** (`site-sw:fresh`).
- Pages refresh the same way, silently (no message — the next open shows it).
- Photos (`/api/photos/…`) are cache-first with no refresh: uploaded filenames
  are timestamped, so a URL never changes what it shows.

### Navigation

RSC requests get a short budget: none at all during an offline hold, 3 s
otherwise. Past it the worker answers with a network error, Next falls back to a
full page load, and that page answers from the copy at once.

### Opening from closed

- **The save pass resumes.** Progress (which pages are done, for which
  build+data fingerprint) is kept in `localStorage`; the next open carries on
  instead of starting again. The last page you used and the dashboard go first.
  Unused photos are pruned only after a pass that ran start to finish in one go.
- **Old code goes last**: only after every page has been re-saved.
- A navigation to `/admin` with no saved copy is answered with the saved
  dashboard rather than the "not saved" page.

### On the page

- `OfflineManager` receives `site-sw:fresh`. On `/admin/honeymoon…` (whose
  `useHoneymoon` already reloads on `REFRESHED_EVENT`) and on any page that has
  registered with `useLiveRefresh(reload)` it dispatches `REFRESHED_EVENT`;
  elsewhere it shows the **Updated · Refresh** pill.
- The dashboard registers `useLiveRefresh`.
- Pull-to-refresh lives in `AdminShell`: only from the very top of the page,
  never starting inside a map, the seating canvas, a dialog or anything that
  scrolls itself. It pings the server; reachable → tell the worker
  (`site-sw:fresh-after`) and reload; unreachable → "Couldn't connect".

## Tests

`npm run check:offline` gains: `readPlan` across the table above, the RSC budget,
the pass order and resume rule. Existing checks stay green.

## Left to the builder

Exact pill styling (follow the offline bar), the pull distance (≈70 px), the
15-second refresh debounce, and the version number at merge time (the other
agent may take the next one first).
