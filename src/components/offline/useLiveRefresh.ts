'use client';

import { useEffect, useRef } from 'react';
import { REFRESHED_EVENT, registerLive } from './offlineStore';

/**
 * Update this page in place when newer data arrives (v0.10.20).
 *
 * Pages answer from the saved copy first and the worker asks the server behind
 * it; when the server's answer differs, a page that called this hook has
 * `reload` run (it reads the copy the worker has just updated), and any other
 * page is offered an "Updated · Refresh" pill instead. Only pages with nothing
 * to type into should use it — reloading a form would replace what is typed.
 */
export function useLiveRefresh(reload: () => void) {
    const latest = useRef(reload);
    useEffect(() => { latest.current = reload; });
    useEffect(() => {
        const unregister = registerLive();
        const onRefreshed = () => latest.current();
        window.addEventListener(REFRESHED_EVENT, onRefreshed);
        return () => {
            unregister();
            window.removeEventListener(REFRESHED_EVENT, onRefreshed);
        };
    }, []);
}
