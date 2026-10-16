import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { createTransporter, escapeHtml, getCoupleName, isMailConfigured } from '@/lib/mail';
import { verifyRsvpLink } from '@/lib/rsvpLink';

interface RsvpInput {
    guestName: string;
    email: string;
    phone: string;
    attending: boolean;
    guestCount: number;
    dietaryJson: string | null;
    message: string | null;
    resolvedMembers: { name: string | null; attending: boolean | null }[] | null;
}

/**
 * Validate the body. Everything the form sends is checked for shape here so a
 * hand-built request cannot write a negative headcount, a non-boolean
 * attendance or a JSON-invalid string into the JSONB column.
 */
function parseInput(body: unknown): RsvpInput | string {
    if (!body || typeof body !== 'object') return 'Invalid request body';
    const b = body as Record<string, unknown>;
    const guestName = typeof b.guestName === 'string' ? b.guestName.trim() : '';
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
    if (!guestName || !email || !phone || typeof b.attending !== 'boolean') {
        return 'Missing required fields';
    }
    if (guestName.length > 255 || email.length > 255 || phone.length > 50) return 'A field is too long';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'That email address does not look right';

    const rawCount = Number(b.guestCount);
    const guestCount = Number.isInteger(rawCount) && rawCount >= 0 ? rawCount : (b.attending ? 1 : 0);

    const dietaryJson = Array.isArray(b.dietaryRestrictions)
        ? JSON.stringify(b.dietaryRestrictions.slice(0, 50))
        : null;

    const message = typeof b.message === 'string' ? b.message.slice(0, 5000) : null;

    const resolvedMembers = Array.isArray(b.resolvedMembers) && b.resolvedMembers.length
        ? b.resolvedMembers.slice(0, 50).map((m) => {
            const obj = m && typeof m === 'object' ? (m as { name?: unknown; attending?: unknown }) : {};
            return {
                name: typeof obj.name === 'string' ? obj.name.slice(0, 255) : null,
                // Per-person answer. Absent (an older client) stays null rather than
                // becoming a guess — the seating chart treats null as "not answered".
                attending: typeof obj.attending === 'boolean' ? obj.attending : null,
            };
        })
        : null;

    return { guestName, email, phone, attending: b.attending, guestCount, dietaryJson, message, resolvedMembers };
}

/**
 * Save an RSVP for a guest on the list.
 *
 * Both POST and PUT land here and behave the same: the household is identified
 * by the primary guest's name — the one the form was filled with from a
 * verified link — and the write itself never trusts a client-supplied
 * household id. The gate above this function is the part that reads `body.id`
 * on a PUT: it loads the existing RSVP row to find out which household the
 * update belongs to, and the household is still matched by name. There is one
 * RSVP row per household: a second submission updates the first rather than
 * adding a duplicate that the dashboard would then count twice.
 *
 * A name that is not on the guest list is refused. It used to be inserted into
 * `guest_list` as an invited guest, which meant the public form could grow the
 * guest list without anyone noticing. That refusal is also why an unlisted
 * name needs no link in the gate: there is nothing for a token to stand in
 * front of.
 */
async function saveRsvp(input: RsvpInput): Promise<{ id: number; isUpdate: boolean }> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const guestRow = await client.query(
            `SELECT id, guest_name, party_size FROM guest_list
              WHERE LOWER(TRIM(guest_name)) = LOWER(TRIM($1)) AND invited = true
              ORDER BY id ASC LIMIT 1`,
            [input.guestName],
        );
        if (guestRow.rows.length === 0) {
            throw Object.assign(new Error('not-on-list'), { status: 404 });
        }
        const guest = guestRow.rows[0];
        const maxParty = Number(guest.party_size) || 1;
        if (input.attending && input.guestCount > maxParty) {
            throw Object.assign(new Error(`Party size exceeds maximum of ${maxParty}`), { status: 400 });
        }
        const count = input.attending ? Math.max(1, input.guestCount) : 0;

        const existing = await client.query(
            'SELECT id FROM rsvps WHERE LOWER(TRIM(guest_name)) = LOWER(TRIM($1)) ORDER BY created_at DESC LIMIT 1',
            [guest.guest_name],
        );

        let id: number;
        const isUpdate = existing.rows.length > 0;
        if (isUpdate) {
            id = existing.rows[0].id;
            await client.query(
                `UPDATE rsvps
                    SET email = $1, phone = $2, attending = $3, number_of_guests = $4,
                        dietary_restrictions = $5, message = $6, updated_at = NOW()
                  WHERE id = $7`,
                [input.email, input.phone, input.attending, count, input.dietaryJson, input.message, id],
            );
        } else {
            const inserted = await client.query(
                `INSERT INTO rsvps (guest_name, email, phone, attending, number_of_guests, dietary_restrictions, message)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [guest.guest_name, input.email, input.phone, input.attending, count, input.dietaryJson, input.message],
            );
            id = inserted.rows[0].id;
        }

        await client.query(
            `UPDATE guest_list
                SET email = $1, phone = $2, rsvp_status = $3,
                    party_members = COALESCE($4::jsonb, party_members),
                    updated_at = NOW()
              WHERE id = $5`,
            [input.email, input.phone, input.attending ? 'attending' : 'declined',
             input.resolvedMembers ? JSON.stringify(input.resolvedMembers) : null,
             guest.id],
        );

        await client.query('COMMIT');
        return { id, isUpdate };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * The household a name belongs to, with the match semantics of
 * `guest-verification` and the magic-link route: the primary guest, a
 * plus-one, or any named party member; invited households only; an exact
 * primary match wins over being listed inside someone else's party, then
 * lowest id, so the answer is deterministic either way.
 */
async function matchHousehold(name: string): Promise<{ id: number; guest_name: string } | null> {
    const normalized = name.trim().toLowerCase();
    const result = await pool.query(
        `SELECT id, guest_name FROM guest_list
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
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * The household this write belongs to, resolved before anything is written.
 *
 * A POST is found by the name in the body; a PUT by the existing RSVP row it
 * edits — `body.id`, loaded here and matched by its guest_name — so an update
 * cannot be aimed at a household its row does not belong to.
 */
async function householdFor(
    method: 'POST' | 'PUT',
    body: Record<string, unknown>,
    guestName: string,
): Promise<{ id: number; guest_name: string } | null> {
    if (method === 'POST') return matchHousehold(guestName);
    const rawId = body.id;
    const id = typeof rawId === 'number' && Number.isInteger(rawId)
        ? rawId
        : (typeof rawId === 'string' && /^\d+$/.test(rawId.trim()) ? parseInt(rawId.trim(), 10) : null);
    if (id === null) {
        throw Object.assign(new Error('An existing RSVP id is required to make changes.'), { status: 400 });
    }
    const row = await pool.query('SELECT guest_name FROM rsvps WHERE id = $1', [id]);
    if (row.rows.length === 0) {
        throw Object.assign(new Error('not-on-list'), { status: 404 });
    }
    return matchHousehold(row.rows[0].guest_name);
}

async function sendEmails(input: RsvpInput) {
    if (!isMailConfigured()) return;
    const couple = getCoupleName();
    try {
        const transporter = createTransporter();

        const status = input.attending ? 'Attending' : 'Not Attending';
        await transporter.sendMail({
            from: `"${couple.replace(/"/g, '')}" <${process.env.SMTP_USER}>`,
            to: input.email,
            subject: 'We received your RSVP!',
            text: `Hi ${input.guestName},\n\nThank you so much for RSVPing to our wedding. We have confirmed your response: ${status}.\n\nWe can't wait to celebrate with you!\n\nBest,\n${couple}`,
            html: `<h1>RSVP Confirmation</h1><p>Hi ${escapeHtml(input.guestName)},</p><p>Thank you so much for RSVPing to our wedding. We have confirmed your response: <strong>${status}</strong>.</p><p>Best,<br>${escapeHtml(couple)}</p>`,
        });

        if (process.env.NOTIFICATION_EMAIL) {
            await transporter.sendMail({
                from: `"Wedding Bot" <${process.env.SMTP_USER}>`,
                to: process.env.NOTIFICATION_EMAIL,
                subject: `New RSVP from ${input.guestName}`,
                text: `Name: ${input.guestName}\nAttending: ${input.attending ? 'Yes' : 'No'}\nGuests: ${input.attending ? input.guestCount : 0}\nEmail: ${input.email}\nPhone: ${input.phone}\nMessage: ${input.message ?? ''}`,
            });
        }
    } catch (emailError) {
        console.error('Failed to send email:', emailError);
    }
}

async function handle(request: Request, method: 'POST' | 'PUT') {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const input = parseInput(body);
    if (typeof input === 'string') return NextResponse.json({ error: input }, { status: 400 });
    const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

    try {
        // The write gate: a household on the guest list may only be RSVP'd
        // through a link the guest got by email. The token must be valid and
        // minted for *this* household — a token for one household cannot open
        // another's RSVP — and it is checked before anything is written.
        //
        // A name that matches no household skips the gate and falls into
        // `saveRsvp`'s refusal below: a name the admin never listed writes
        // nothing, so it needs no link. That is deliberately left as-is (the
        // demo instance lives entirely in it) and is out of scope for the
        // household leak this gate closes.
        const household = await householdFor(method, record, input.guestName);
        if (household) {
            const link = await verifyRsvpLink(typeof record.token === 'string' ? record.token : null);
            if (!link || link.guestListId !== household.id) {
                return NextResponse.json(
                    { error: 'This RSVP needs a valid link from your email. Ask for a fresh one on the RSVP page.' },
                    { status: 403 }
                );
            }

            // On a PUT, the household above comes from `body.id` — the RSVP row
            // being edited — not from `body.guestName`, which is what `saveRsvp`
            // actually writes through below. Without this check the two could
            // disagree: a guest's own valid link (minted for their own existing
            // RSVP's id) could carry a different household's name, and the write
            // would land on that other household instead of the one just gated.
            const writeTarget = await matchHousehold(input.guestName);
            if (!writeTarget || writeTarget.id !== household.id) {
                return NextResponse.json(
                    { error: 'This RSVP needs a valid link from your email. Ask for a fresh one on the RSVP page.' },
                    { status: 403 }
                );
            }
        }

        const { id, isUpdate } = await saveRsvp(input);
        await sendEmails(input);
        return NextResponse.json({ success: true, id, updated: isUpdate });
    } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
            return NextResponse.json(
                { error: 'We could not find that name on the guest list. Please go back and check the spelling.' },
                { status: 404 },
            );
        }
        if (status === 400) {
            return NextResponse.json({ error: (error as Error).message }, { status: 400 });
        }
        console.error('RSVP API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    return handle(request, 'POST');
}

/**
 * Same gate as POST, but the household comes from the existing RSVP row the
 * update edits — `body.id` — not from the name in the body. The write itself
 * still lands by the household's primary name, as always.
 */
export async function PUT(request: Request) {
    return handle(request, 'PUT');
}
