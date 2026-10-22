/**
 * Where signing in takes you back to.
 *
 * Two sources, in order. The middleware puts the page you asked for in the
 * login link's `next`, so an expired session lands you back on it. When that is
 * only the app's front door — the installed app always opens at `/admin` — the
 * page you were last on, which the admin shell records on every navigation,
 * wins instead: on a phone, the front door is where the app reopens, not
 * somewhere you chose to go.
 *
 * Only paths inside the admin panel are ever followed. A `next` is part of a
 * link anyone can craft, so anything else (another site, `//evil.example`, a
 * backslash trick) is ignored rather than trusted.
 */

/** localStorage key for the last admin page shown on this device. */
export const LAST_ADMIN_PAGE_KEY = 'admin-last-page';

/** The paths that mean "the app was opened", not "I was here". */
const FRONT_DOORS = new Set(['/admin', '/admin/', '/admin/dashboard']);

/** The path if it is a safe place to send someone after signing in, else null. */
export function safeAdminPath(raw: string | null | undefined): string | null {
    if (!raw || typeof raw !== 'string') return null;
    if (!raw.startsWith('/admin') || raw.startsWith('//') || raw.includes('\\')) return null;
    // `/admins`, `/administrator` — not ours.
    const rest = raw.slice('/admin'.length);
    if (rest !== '' && !/^[/?#]/.test(rest)) return null;
    let path: string;
    try {
        path = new URL(raw, 'https://x.invalid').pathname;
    } catch {
        return null;
    }
    if (path.startsWith('/admin/login')) return null;
    return raw;
}

/** Where to go after a successful sign-in. */
export function loginDestination(next: string | null | undefined, lastPage: string | null | undefined): string {
    const asked = safeAdminPath(next);
    const last = safeAdminPath(lastPage);
    const askedPath = asked ? asked.split(/[?#]/)[0] : null;
    if (asked && askedPath && !FRONT_DOORS.has(askedPath)) return asked;
    return last ?? asked ?? '/admin';
}

/**
 * On opening the installed app, the page to restore, or null to stay put.
 *
 * Only when the app opened at its front door, and only to somewhere else.
 */
export function launchRestore(current: string, lastPage: string | null | undefined): string | null {
    if (!FRONT_DOORS.has(current.split(/[?#]/)[0])) return null;
    const last = safeAdminPath(lastPage);
    if (!last || FRONT_DOORS.has(last.split(/[?#]/)[0])) return null;
    return last;
}
