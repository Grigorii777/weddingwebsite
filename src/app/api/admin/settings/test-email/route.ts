import { NextResponse } from 'next/server';
import { hasNotificationEmail, isMailConfigured, sendTestMail } from '@/lib/mail';

/**
 * Send the test mail.
 *
 * It accepts no body at all — the recipient is the stack's NOTIFICATION_EMAIL
 * and nothing else, so the button cannot be turned into a way of mailing an
 * address a caller typed. The send goes out over the network, which is why
 * the offline worker refuses to queue it (NOT_QUEUED in public/sw.js): a test
 * pressed with no connection has nothing to retry later.
 */
export async function POST() {
    if (!isMailConfigured()) {
        return NextResponse.json(
            { error: 'Email is not configured. Set SMTP_HOST and SMTP_USER (and NOTIFICATION_EMAIL for the test recipient) in the stack environment.' },
            { status: 400 },
        );
    }
    if (!hasNotificationEmail()) {
        return NextResponse.json(
            { error: 'NOTIFICATION_EMAIL is not set — the test mail has no recipient.' },
            { status: 400 },
        );
    }
    const result = await sendTestMail();
    if (result.ok) return NextResponse.json({ success: true });
    return NextResponse.json({ error: `Test mail failed: ${result.error}` }, { status: 502 });
}
