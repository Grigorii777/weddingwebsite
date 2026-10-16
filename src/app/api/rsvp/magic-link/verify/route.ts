import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyRsvpLink } from '@/lib/rsvpLink';

/**
 * Exchange an RSVP link for the household's details.
 *
 * This is the only door to the details `guest-verification` used to hand out
 * on a name alone: the household's email and phone, the party, and the
 * RSVP already sent. The token carries the household id and the matched
 * seat's stored name; the household is re-read from the database and must
 * still be an invited one — a household the admin un-invited or deleted dies
 * with its links. A missing or un-invited household gets the same answer as
 * an invalid or expired token: there is no answer that says "that id used to
 * exist".
 */
export async function POST(request: Request) {
    try {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            body = null;
        }
        const rawToken = body && typeof body === 'object' ? (body as { token?: unknown }).token : null;
        const token = typeof rawToken === 'string' ? rawToken : null;

        const link = await verifyRsvpLink(token);
        const invalid = NextResponse.json(
            { error: 'That link is not valid, or it has expired. You can ask for a new one from the RSVP page.' },
            { status: 400 }
        );
        if (!link) return invalid;

        const guestResult = await pool.query(
            'SELECT * FROM guest_list WHERE id = $1 AND invited = true',
            [link.guestListId]
        );
        if (guestResult.rows.length === 0) return invalid;
        const guest = guestResult.rows[0];

        // The seat the token was minted for, in the stored spelling.
        const isPrimary = (guest.guest_name || '').trim().toLowerCase() === link.guest.trim().toLowerCase();

        // The RSVP is always filed under the primary guest, so look it up by
        // that name or a plus-one's link would never find the existing RSVP.
        const rsvpResult = await pool.query(
            'SELECT * FROM rsvps WHERE LOWER(guest_name) = LOWER($1) ORDER BY created_at DESC LIMIT 1',
            [(guest.guest_name || '').trim()]
        );

        let existingRsvp = null;
        if (rsvpResult.rows.length > 0) {
            const rsvp = rsvpResult.rows[0];
            existingRsvp = {
                id: rsvp.id,
                attending: rsvp.attending,
                guestCount: rsvp.number_of_guests,
                email: rsvp.email,
                phone: rsvp.phone,
                dietaryRestrictions: rsvp.dietary_restrictions,
                message: rsvp.message,
            };
        }

        return NextResponse.json({
            verified: true,
            guest: {
                name: guest.guest_name,
                party_size: guest.party_size,
                email: guest.email,
                phone: guest.phone,
                party_members: guest.party_members || [],
            },
            // The form greets whoever the link was for, so a plus-one isn't
            // confused by seeing the primary guest's name.
            matched: { name: link.guest, isPrimary },
            existingRsvp,
        });
    } catch (error) {
        console.error('Error verifying RSVP link:', error);
        return NextResponse.json(
            { error: 'That link is not valid, or it has expired. You can ask for a new one from the RSVP page.' },
            { status: 500 }
        );
    }
}
