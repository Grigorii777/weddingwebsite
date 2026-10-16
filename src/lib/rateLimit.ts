/**
 * A small fixed-window rate limiter, per key, in process memory.
 *
 * Enough for a single-instance site: it stops a script hammering the login or
 * RSVP endpoints without needing Redis. Edge-safe (no Node APIs), so the
 * middleware can use it. Counts reset when the process restarts, which is fine
 * for the purpose.
 */
interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 5000) {
        for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterSeconds: 0 };
    }
    bucket.count += 1;
    if (bucket.count > limit) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
    }
    return { ok: true, retryAfterSeconds: 0 };
}

/**
 * The caller's address, as seen through a reverse proxy.
 *
 * `cf-connecting-ip` first — only a Cloudflare front sets it, and it holds the
 * real client when Cloudflare is in the chain (the `X-Forwarded-For` it leaves
 * behind ends with Cloudflare's own egress address, not the guest's). Then the
 * LAST `X-Forwarded-For` entry: a standard proxy appends the peer it actually
 * saw, so everything the client put in the header sits before the one entry
 * the nearest proxy wrote — the first entry, taken in the past, was
 * client-controllable and let a script mint a fresh identity per request and
 * walk through every per-IP limit. Then `x-real-ip` (set by an nginx-style
 * proxy). With no proxy in front, every one of these headers is something the
 * caller typed — the shared `unknown` bucket is the honest answer, and it is
 * stricter than any of them, never looser.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
    const connecting = headers.get('cf-connecting-ip');
    if (connecting) return connecting.trim();
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
        const last = forwarded.split(',').pop()?.trim();
        if (last) return last;
    }
    return headers.get('x-real-ip') || 'unknown';
}
