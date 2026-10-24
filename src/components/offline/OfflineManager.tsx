'use client';
import { counted } from '@/lib/locale';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SITE_WORKER_URL } from '@/lib/offline';
import { describeWrite } from './outbox';
import { REFRESHED_EVENT, checkForUpdates, dismissFailed, getServerState, getState, hasLive, inFrame, subscribe } from './offlineStore';

/** "today 14:02", "yesterday 09:15", "Mon 5 Oct". */
export function savedLabel(at: number, now = Date.now()): string {
    const date = new Date(at);
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    if (at >= startOfToday.getTime()) return `сегодня ${time}`;
    if (at >= startOfToday.getTime() - 86_400_000) return `вчера ${time}`;
    return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function useOfflineState() {
    return useSyncExternalStore(subscribe, getState, getServerState);
}

/**
 * Online, as far as this page can tell: the browser's own flag, corrected by
 * the worker, which says so whenever it had to answer from the saved copy —
 * the browser's flag stays "online" on a page opened offline, and on a weak or
 * captive signal.
 */
function useOnline(): boolean {
    const [browserOnline, setBrowserOnline] = useState(true);
    const [workerOffline, setWorkerOffline] = useState(false);
    useEffect(() => {
        // The hidden save-pass frames draw no bar, so they need not ask.
        if (inFrame()) return;
        const apply = () => setBrowserOnline(navigator.onLine);
        apply();
        window.addEventListener('online', apply);
        window.addEventListener('offline', apply);
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type !== 'site-sw:offline') return;
            setWorkerOffline(true);
            // The worker also answers from the saved copy when the server is
            // merely slow, so check for ourselves rather than trusting it: a
            // reachable server clears the bar straight away.
            if (!inFlight) recheck();
        };
        navigator.serviceWorker?.addEventListener('message', onMessage);
        navigator.serviceWorker?.startMessages?.();
        // Ask the server directly: the worker never answers this from the saved
        // copy, so silence means offline. While offline, keep asking, so a
        // returning signal clears the bar without waiting for a page load.
        let stopped = false;
        let current: AbortController | null = null;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let inFlight = false;
        const ping = () => {
            inFlight = true;
            current = new AbortController();
            const cap = setTimeout(() => current?.abort(), 5000);
            fetch('/api/offline/ping', { cache: 'no-store', signal: current.signal })
                // Read the body, or the request stays open and holds a connection.
                .then(async (res) => { await res.text().catch(() => ''); return res.ok; })
                .catch(() => false)
                .then((reached) => {
                    clearTimeout(cap);
                    inFlight = false;
                    if (stopped) return;
                    setWorkerOffline(!reached);
                    if (!reached) retry = setTimeout(ping, 15000);
                });
        };
        ping();
        const recheck = () => { if (retry) clearTimeout(retry); ping(); };
        window.addEventListener('online', recheck);
        return () => {
            stopped = true;
            current?.abort();
            if (retry) clearTimeout(retry);
            window.removeEventListener('online', recheck);
            window.removeEventListener('online', apply);
            window.removeEventListener('offline', apply);
            navigator.serviceWorker?.removeEventListener('message', onMessage);
        };
    }, []);
    return browserOnline && !workerOffline;
}


/**
 * Newer data arrived for this page after its saved copy answered (v0.10.20).
 *
 * The honeymoon portal (whose `useHoneymoon` reloads on `REFRESHED_EVENT`) and
 * pages using `useLiveRefresh` update in place; any other page gets `true`, the
 * cue for the "Updated · Refresh" pill. Cleared when the page changes.
 */
function useFreshData(): { updated: boolean; signedOut: boolean } {
    const pathname = usePathname();
    const [updated, setUpdated] = useState(false);
    const [signedOut, setSignedOut] = useState(false);
    const path = useRef(pathname);
    useEffect(() => {
        path.current = pathname;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUpdated(false);
    }, [pathname]);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (pathname === '/admin/login') setSignedOut(false);
    }, [pathname]);
    useEffect(() => {
        if (inFrame() || !('serviceWorker' in navigator)) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === 'site-sw:signed-out') { setSignedOut(true); return; }
            if (event.data?.type !== 'site-sw:fresh') return;
            // A page loading several things hears about several; act once.
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                if (hasLive() || (path.current ?? '').startsWith('/admin/honeymoon')) {
                    window.dispatchEvent(new CustomEvent(REFRESHED_EVENT));
                } else {
                    setUpdated(true);
                }
            }, 400);
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => {
            if (timer) clearTimeout(timer);
            navigator.serviceWorker.removeEventListener('message', onMessage);
        };
    }, []);
    return { updated, signedOut };
}

/**
 * The site, offline: registered on every page from the app shell.
 *
 * Registers the site-wide worker and says so when there is no connection.
 * Whenever the page opens, comes back to the foreground or gets its
 * connection back, it sends any edits made offline and — in the installed app —
 * asks the server whether anything changed, refreshing the saved copy if so.
 * In an ordinary browser tab it only saves what you visit.
 */
export default function OfflineManager() {
    const online = useOnline();
    const offline = useOfflineState();
    const { updated, signedOut } = useFreshData();
    const [showFailed, setShowFailed] = useState(false);
    const wasOnline = useRef(online);

    useEffect(() => {
        if (inFrame() || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register(SITE_WORKER_URL, { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
        // After the page has settled, so the first paint never waits on it.
        const timer = setTimeout(() => { void checkForUpdates({ force: true }); }, 2500);
        const onOnline = () => { void checkForUpdates({ force: true }); };
        // Opening the installed app again from the home screen resumes it
        // rather than loading it, so "opened" is also "became visible".
        const onVisible = () => { if (document.visibilityState === 'visible') void checkForUpdates(); };
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    // The server answered again after a spell without it: send and refresh.
    useEffect(() => {
        if (online && !wasOnline.current && !inFrame()) void checkForUpdates({ force: true });
        wasOnline.current = online;
    }, [online]);

    if (inFrame()) return null;
    const waiting = offline.pending > 0;
    const failed = offline.failed.length > 0;
    if (online && !waiting && !failed && !updated && !signedOut) return null;

    let message: React.ReactNode;
    if (!online) {
        message = (
            <>
                Без интернета
                {offline.record ? ` · показана копия от ${savedLabel(offline.record.at)}` : ' · показана сохранённая копия'}
                {waiting && ` · ${counted(offline.pending, 'изменение', 'изменения', 'изменений')} сохранено на телефоне; отправим при подключении к интернету`}
            </>
        );
    } else if (waiting && offline.needsLogin) {
        message = (
            <>
                {counted(offline.pending, 'изменение', 'изменения', 'изменений')} ожидают отправки ·{' '}
                <Link href="/admin/login" className="underline underline-offset-2">Войти для отправки</Link>
            </>
        );
    } else if (waiting) {
        message = <>Отправляем {counted(offline.pending, 'изменение', 'изменения', 'изменений')} без интернета…</>;
    } else if (signedOut) {
        message = (
            <>
                Вы вышли · показана сохранённая копия ·{' '}
                <Link
                    href={`/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                    className="underline underline-offset-2"
                >
                    Войти
                </Link>
            </>
        );
    } else if (updated) {
        message = (
            <>
                На сервере есть обновления ·{' '}
                <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2">
                    Обновить
                </button>
            </>
        );
    }

    return (
        <div
            role="status"
            data-offline-banner
            data-pending={offline.pending}
            className="pointer-events-none fixed inset-x-0 z-[95] flex flex-col items-center gap-2 px-4"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
            {message && (
                <p className="pointer-events-auto max-w-md rounded-full bg-gray-900/90 px-4 py-1.5 text-center text-xs font-medium text-white shadow-lg backdrop-blur">
                    {message}
                </p>
            )}
            {failed && (
                <div data-offline-failed className="pointer-events-auto max-w-md rounded-2xl bg-red-700/95 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
                    <div className="flex items-center gap-3">
                        <span className="font-medium">
                            {counted(offline.failed.length, 'изменение без интернета', 'изменения без интернета', 'изменений без интернета')} не удалось сохранить
                        </span>
                        <button type="button" onClick={() => setShowFailed((v) => !v)} className="min-h-[44px] underline underline-offset-2">
                            {showFailed ? 'Скрыть' : 'Подробности'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowFailed(false); void dismissFailed(); }}
                            className="min-h-[44px] rounded-full bg-white/15 px-3"
                        >
                            Закрыть
                        </button>
                    </div>
                    {showFailed && (
                        <ul className="mt-1 space-y-1 pb-1">
                            {offline.failed.map((write) => (
                                <li key={write.seq}>
                                    {describeWrite(write.method, write.url)} — {write.error}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
