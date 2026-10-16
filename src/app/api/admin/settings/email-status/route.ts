import { NextResponse } from 'next/server';
import { getMailHost, hasNotificationEmail, isMailConfigured } from '@/lib/mail';

/**
 * The state of the site's mail, for the admin's Email section.
 *
 * Everything here is safe to show: the host is a setting, and the booleans say
 * only that a variable is present — the password never crosses this wire.
 */
export async function GET() {
    return NextResponse.json({
        success: true,
        configured: isMailConfigured(),
        host: getMailHost(),
        notificationEmailSet: hasNotificationEmail(),
    });
}
