/**
 * How an RSVP write proves it belongs to the household it edits.
 *
 * Three real modes, plus 'auto' (the stored preference) which resolves to one
 * of them based on whether mail is configured:
 *
 * - **link** — a signed link mailed to the household's address gates both a
 *   first RSVP and every update. Strongest, but needs SMTP: with none
 *   configured the link endpoint always answers the same generic message and
 *   never actually sends anything, so a guest would wait forever.
 * - **verify** — no email needed. A first RSVP for a household needs nothing
 *   (there is nothing on file yet to protect); updating an existing one
 *   requires typing the email already on file for it. Weaker than a link —
 *   it is a knowledge check, not proof the typist controls that inbox — but
 *   it stops a casual guest from overwriting someone else's answer without
 *   requiring any mail setup at all.
 * - **simple** — no check at all, on a first RSVP or an update: the way the
 *   form worked before links existed. An admin's explicit, named choice to
 *   reopen that hole, not a default.
 *
 * Both the read side (`guest-verification`, `verify-email`) and the write
 * gate in `src/app/api/rsvp/route.ts` call `effectiveRsvpMode()` themselves
 * rather than trusting anything the client claims the mode is — the same
 * reason the write gate re-checks a token instead of trusting that the form
 * was reached through a verified step.
 */
export type RsvpModeSetting = 'auto' | 'link' | 'verify' | 'simple';
export type EffectiveRsvpMode = 'link' | 'verify' | 'simple';

export function effectiveRsvpMode(configured: RsvpModeSetting | undefined, mailConfigured: boolean): EffectiveRsvpMode {
    const mode = configured || 'auto';
    if (mode === 'auto') return mailConfigured ? 'link' : 'verify';
    return mode;
}
