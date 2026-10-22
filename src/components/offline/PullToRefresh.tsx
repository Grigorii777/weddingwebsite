'use client';

import { useEffect, useRef, useState } from 'react';
import { inFrame, isStandalone } from './offlineStore';

/** How far to pull, in pixels after damping, before letting go refreshes. */
const TRIGGER = 70;
const MAX_PULL = 100;

/**
 * Where a pull must not start: anything that pans or scrolls on its own (the
 * map, the seating canvas), a dialog, or a field being typed in.
 */
const NO_PULL = '.leaflet-container, .react-flow, [role="dialog"], [data-no-pull], input, textarea, select, [contenteditable="true"]';

/** True when the touch began at the very top of everything that scrolls under it. */
function atTop(target: EventTarget | null): boolean {
    if (!(target instanceof Element) || target.closest(NO_PULL)) return false;
    if (window.scrollY > 0) return false;
    for (let el: Element | null = target; el; el = el.parentElement) {
        if (el.scrollTop > 0) return false;
    }
    return true;
}

async function reachable(): Promise<boolean> {
    const controller = new AbortController();
    const cap = setTimeout(() => controller.abort(), 4000);
    try {
        const res = await fetch('/api/offline/ping', { cache: 'no-store', signal: controller.signal });
        await res.text().catch(() => '');
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(cap);
    }
}

/** Tell the worker every saved copy is now older than a refresh asked for. */
async function askForFresh(): Promise<void> {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return;
    await new Promise<void>((resolve) => {
        const timer = setTimeout(done, 1500);
        function onMessage(event: MessageEvent) {
            if (event.data?.type === 'site-sw:fresh-after-done') done();
        }
        function done() {
            clearTimeout(timer);
            navigator.serviceWorker.removeEventListener('message', onMessage);
            resolve();
        }
        navigator.serviceWorker.addEventListener('message', onMessage);
        worker.postMessage({ type: 'site-sw:fresh-after' });
    });
}

/**
 * Pull down at the top of an admin page to refresh, as in Mail (v0.10.20).
 *
 * The installed app has no browser pull-to-refresh of its own. With a
 * connection, the page reloads from the server; without one it says so and
 * leaves everything on screen as it was. Only in the installed app — a browser
 * tab already has its own.
 */
export default function PullToRefresh() {
    const [pull, setPull] = useState(0);
    const [status, setStatus] = useState<'idle' | 'checking' | 'offline'>('idle');
    const start = useRef<number | null>(null);
    const pulled = useRef(0);
    const busy = useRef(false);

    useEffect(() => {
        if (inFrame() || !isStandalone()) return;
        const onStart = (event: TouchEvent) => {
            if (busy.current || event.touches.length !== 1 || !atTop(event.target)) { start.current = null; return; }
            start.current = event.touches[0].clientY;
        };
        const onMove = (event: TouchEvent) => {
            if (start.current === null) return;
            const dy = event.touches[0].clientY - start.current;
            pulled.current = dy > 0 ? Math.min(dy * 0.5, MAX_PULL) : 0;
            setPull(pulled.current);
        };
        const onEnd = async () => {
            if (start.current === null) return;
            start.current = null;
            const far = pulled.current >= TRIGGER;
            pulled.current = 0;
            setPull(0);
            if (!far) return;
            busy.current = true;
            setStatus('checking');
            if (await reachable()) {
                await askForFresh();
                window.location.reload();
                return;
            }
            setStatus('offline');
            setTimeout(() => { setStatus('idle'); busy.current = false; }, 2500);
        };
        window.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd);
        window.addEventListener('touchcancel', onEnd);
        return () => {
            window.removeEventListener('touchstart', onStart);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('touchcancel', onEnd);
        };
    }, []);

    if (pull === 0 && status === 'idle') return null;
    const ready = pull >= TRIGGER;
    return (
        <div
            role="status"
            data-pull-refresh={status}
            className="pointer-events-none fixed inset-x-0 z-[96] flex justify-center"
            style={{ top: `calc(env(safe-area-inset-top, 0px) + ${status === 'idle' ? pull - 36 : 12}px)` }}
        >
            {status === 'offline' ? (
                <p className="rounded-full bg-gray-900/90 px-4 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur">
                    Couldn&apos;t connect · showing what this phone has saved
                </p>
            ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-lg backdrop-blur">
                    <svg
                        className={`h-4 w-4 transition-transform ${status === 'checking' ? 'animate-spin' : ''}`}
                        style={status === 'idle' ? { transform: `rotate(${ready ? 180 : (pull / TRIGGER) * 180}deg)` } : undefined}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
                    >
                        {status === 'checking'
                            ? <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0-6-6m6 6 6-6" />}
                    </svg>
                    <span className="sr-only">{status === 'checking' ? 'Refreshing' : ready ? 'Let go to refresh' : 'Pull to refresh'}</span>
                </span>
            )}
        </div>
    );
}
