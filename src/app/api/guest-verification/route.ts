import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Is that name on the guest list, and which seat did they type?
 *
 * That is the whole answer now: the matched seat's stored name and whether
 * it is the primary guest. The household's email, phone, party size, party
 * members and existing RSVP used to ride out of this endpoint too, so anyone
 * who could read an invitation could read the household's contact details —
 * and the write path sat on the same name, so seeing the details and editing
 * the RSVP were one guess apart. Those details now travel behind the email
 * link (the form exchanges it at `/api/rsvp/magic-link/verify`), and this
 * endpoint's job is to say "yes, that name is here, and it is this seat of
 * the party" — nothing more.
 */
export async function POST(request: Request) {
  try {
    const { guest_name } = await request.json();

    if (typeof guest_name !== 'string' || !guest_name.trim()) {
      return NextResponse.json(
        { verified: false, message: 'Guest name is required' },
        { status: 400 }
      );
    }

    const typedName = guest_name.trim();
    const normalized = typedName.toLowerCase();

    // Anyone in the party can look the RSVP up by their own name — the primary guest,
    // a plus-one, or any named party member. A plus-one shouldn't have to know whose
    // name the invitation was filed under.
    // Ordering: an exact primary-guest match wins over being listed inside someone
    // else's party, then lowest id, so the result is deterministic either way.
    const guestResult = await pool.query(
      `SELECT * FROM guest_list
        WHERE invited = true
          AND (
            LOWER(TRIM(guest_name)) = $1
            OR LOWER(TRIM(COALESCE(plus_one_name, ''))) = $1
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(party_members) = 'array' THEN party_members ELSE '[]'::jsonb END
              ) AS m
              WHERE LOWER(TRIM(COALESCE(m->>'name', ''))) = $1
            )
          )
        ORDER BY (LOWER(TRIM(guest_name)) = $1) DESC, id ASC
        LIMIT 1`,
      [normalized]
    );

    if (guestResult.rows.length > 0) {
      const guest = guestResult.rows[0];

      // Who actually typed in, using the stored spelling rather than what they typed.
      const isPrimary = (guest.guest_name || '').trim().toLowerCase() === normalized;
      const members = Array.isArray(guest.party_members) ? guest.party_members : [];
      const matchedMember = members.find(
        (m: { name?: string | null }) => (m?.name || '').trim().toLowerCase() === normalized
      );
      const matchedPlusOne = (guest.plus_one_name || '').trim().toLowerCase() === normalized
        ? guest.plus_one_name
        : null;
      const matchedName = isPrimary
        ? guest.guest_name
        : (matchedMember?.name || matchedPlusOne || typedName);

      // Only the seat: the household's details now travel behind the email
      // link, so a name alone cannot read a household it is not meant to see.
      return NextResponse.json({
        verified: true,
        matched: { name: matchedName, isPrimary },
      });
    }

    return NextResponse.json({
      verified: false,
      message: 'We could not find your name on our guest list. Please check the spelling or contact us if you believe this is an error.',
    });
  } catch (error) {
    console.error('Error verifying guest:', error);
    return NextResponse.json(
      { verified: false, message: 'Error verifying guest' },
      { status: 500 }
    );
  }
}
