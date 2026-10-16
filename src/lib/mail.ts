import nodemailer from 'nodemailer';
import { getSiteConfig } from '@/lib/config';

/**
 * The site's mail, in one place.
 *
 * The RSVP route and the admin's Email section both ask the same questions —
 * is there a server to send through, what is it called, who signs the mail —
 * so the transporter, the escaping and those answers live here once, and the
 * two surfaces cannot drift.
 *
 * Anything this module sends goes to an address the server holds, never one a
 * caller typed: there is no destination parameter anywhere in the mail paths,
 * so none of them can be pointed at an arbitrary address.
 */

/** The host the mail goes out through, or null when there is none. The password is never surfaced. */
export function getMailHost(): string | null {
    const host = (process.env.SMTP_HOST ?? '').trim();
    return host === '' ? null : host;
}

/** True when the stack has enough set for a send to be attempted. */
export function isMailConfigured(): boolean {
    const host = (process.env.SMTP_HOST ?? '').trim();
    const user = (process.env.SMTP_USER ?? '').trim();
    return host !== '' && user !== '';
}

/** True when a test mail would have somewhere to go. */
export function hasNotificationEmail(): boolean {
    return (process.env.NOTIFICATION_EMAIL ?? '').trim() !== '';
}

/** The couple, the way the mail signs itself: both names, or the fallback. */
export function getCoupleName(): string {
    const config = getSiteConfig();
    return config.brideName && config.groomName
        ? `${config.brideName} & ${config.groomName}`
        : 'The Couple';
}

/** The transporter the mail goes out on. Call it only when `isMailConfigured()` holds. */
export function createTransporter() {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        // Implicit TLS on 465; STARTTLS is negotiated on 587/25.
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
}

/**
 * A test mail, sent by the admin's Email section.
 *
 * It goes to `NOTIFICATION_EMAIL` and nowhere else — the route that calls it
 * accepts no body at all, so the button cannot be aimed at an address a
 * caller types.
 */
export async function sendTestMail(): Promise<{ ok: boolean; error?: string }> {
    const to = (process.env.NOTIFICATION_EMAIL ?? '').trim();
    if (to === '') return { ok: false, error: 'NOTIFICATION_EMAIL is not set — the test mail has no recipient.' };
    if (!isMailConfigured()) return { ok: false, error: 'Email is not configured.' };
    try {
        const couple = getCoupleName();
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"${couple.replace(/"/g, '')}" <${process.env.SMTP_USER}>`,
            to,
            subject: 'Wedding website — email test',
            text: `This is a test mail from the wedding website's admin panel.\n\nIf you are reading this, the SMTP settings on this instance are working.\n\n— ${couple}`,
        });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Escape a value before it goes into an HTML email body.
 *
 * The confirmation email interpolated the guest's own typed name straight into
 * markup. The form sends that email to whatever address was entered, so anyone
 * could have used the RSVP form to deliver a wedding-branded email carrying
 * markup of their choosing to a third party. The name is the only free-text
 * field that reaches the HTML version — the notification to the couple is plain
 * text — but the fix belongs at the boundary, not in a note about which fields
 * happen to be safe today.
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
