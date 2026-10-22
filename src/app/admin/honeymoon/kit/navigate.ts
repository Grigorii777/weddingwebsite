/**
 * Switching tabs inside the honeymoon portal, without asking the server.
 *
 * Every tab is a thin page over data the shell already holds, so a tab change
 * needs nothing from the network. A normal Next navigation still asks the
 * server for the new page's payload first — a round trip on every tap, slow on
 * a weak signal and a full page load with none. `history.pushState` updates the
 * URL and `usePathname()` with no request at all (Next integrates it), and the
 * shell draws the tab from the path (`TabView`). Refreshing, bookmarks and
 * opening a link still load the real page, so every tab keeps its own URL.
 */

const BASE = '/admin/honeymoon';

/** The paths the shell can draw by itself. */
export const TAB_PATHS = new Set([
    BASE, `${BASE}/today`, `${BASE}/itinerary`, `${BASE}/map`, `${BASE}/places`, `${BASE}/stays`,
    `${BASE}/excursions`, `${BASE}/travel`, `${BASE}/checklist`, `${BASE}/files`, `${BASE}/guide`,
    `${BASE}/settings`,
]);

/** Normalise a trailing slash so `/admin/honeymoon/` is the overview. */
export function tabPath(pathname: string): string {
    return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function isTabPath(pathname: string): boolean {
    return TAB_PATHS.has(tabPath(pathname));
}

/** Go to a tab now. Returns false when the path is not one the shell can draw. */
export function goTab(href: string): boolean {
    if (typeof window === 'undefined') return false;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !isTabPath(url.pathname)) return false;
    if (url.pathname + url.search !== window.location.pathname + window.location.search) {
        window.history.pushState(null, '', url.pathname + url.search + url.hash);
    }
    return true;
}
