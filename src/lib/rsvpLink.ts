import { SignJWT, jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/auth';

/**
 * Guest RSVP link tokens.
 *
 * The name lookup on the RSVP page answers only "that name is on the list" —
 * the household's details travel instead inside a link mailed to the address
 * the site already holds for them, and it is the link, not the name, that the
 * form hands the server before anything is read or written.
 *
 * The token is signed with the same key as the admin session
 * (`JWT_SECRET`, falling back to `ADMIN_PASSWORD` — see `auth.ts`), so there
 * is no new key to set and a misconfigured instance stays locked rather than
 * open: with no secret, nothing signs and nothing verifies. The `role` claim
 * keeps the two token kinds from being passed to each other's endpoints — an
 * admin cookie is not a guest link, and a guest link is not an admin cookie.
 */

/** How long a link stays valid: it should outlive the whole form. */
export const RSVP_LINK_SECONDS = 60 * 60;

/**
 * Sign a link for one household and the seat that asked for it.
 *
 * `matchedName` is the matched member's name as stored (not as typed), so the
 * form can greet the right person — a plus-one is not the primary guest.
 * Returns null when no secret is configured.
 */
export async function signRsvpLink(guestListId: number, matchedName: string): Promise<string | null> {
    const secret = getJwtSecret();
    if (!secret) return null;
    return new SignJWT({ sub: String(guestListId), guest: matchedName, role: 'rsvp-link' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${RSVP_LINK_SECONDS}s`)
        .sign(secret);
}

/**
 * The link's payload when the token is valid, otherwise null.
 *
 * `sub` is the household's guest_list id (JWT subjects are strings, so it is
 * carried as one); `guest` is the matched member's stored name. Expiry is
 * checked by the verify itself. A malformed token, an expired one, a token
 * signed with a different key and the wrong kind of token (an admin session,
 * say) all answer null the same way — the caller treats "not a link" as
 * "no good", so there is nothing to probe here.
 */
export async function verifyRsvpLink(
    token: string | null | undefined,
): Promise<{ guestListId: number; guest: string } | null> {
    if (!token) return null;
    const secret = getJwtSecret();
    if (!secret) return null;
    try {
        const { payload } = await jwtVerify(token, secret);
        if (payload.role !== 'rsvp-link') return null;
        if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) return null;
        const guest = typeof payload.guest === 'string' ? payload.guest : '';
        return { guestListId: parseInt(payload.sub, 10), guest };
    } catch {
        return null;
    }
}
