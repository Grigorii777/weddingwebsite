'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Swipe left and right to page — one day to the next — with the content
 * following the finger.
 *
 * Replaces the ‹ › buttons on a phone. A horizontal drag moves the page with
 * the finger (with resistance at the first and last page, so the end of the
 * trip feels like a wall rather than nothing happening); letting go past a
 * third of the way, or with a flick, pages over and the next page slides in
 * from the side it came from. Anything short of that springs back.
 *
 * It stays out of the way of everything that already owns a horizontal drag:
 * the text field you are typing in, anything marked `data-no-swipe`, and any row that scrolls
 * sideways (the day strip, a segmented control) — so swiping the strip
 * scrolls the strip, and swiping the page turns the page. A drag that starts
 * mostly vertical is a scroll and is left entirely alone.
 *
 * `pageKey` is whatever identifies the page shown (the day's id): when it
 * changes after a swipe, the new page is animated in. Changes from anywhere
 * else (tapping a day in the strip) also slide, in the direction of travel.
 *
 * A descendant marked `data-swipe-slide` is the part that moves, when there is
 * one; the element the ref is on still takes the swipe. Today marks the day
 * under its header, so the header and the day dots hold still.
 */
/** What moves: the marked part of the page if there is one, else the whole of it. */
function slideTarget(root: HTMLElement): HTMLElement {
    return root.querySelector<HTMLElement>('[data-swipe-slide]') ?? root;
}

export function useSwipePager<T extends HTMLElement>({
    pageKey, order, onPrev, onNext, canPrev, canNext, enabled = true,
}: {
    pageKey: string | number | null;
    /** The page's position, so a jump from the strip slides the right way. */
    order: number;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
    enabled?: boolean;
}) {
    const ref = useRef<T | null>(null);
    /** Set by a swipe, so the page it causes slides in the swipe's direction. */
    const swipedRef = useRef<'prev' | 'next' | null>(null);
    const latest = useRef({ onPrev, onNext, canPrev, canNext });
    useLayoutEffect(() => { latest.current = { onPrev, onNext, canPrev, canNext }; });

    useEffect(() => {
        const node = ref.current;
        if (!node || !enabled) return;
        let startX = 0, startY = 0, startT = 0, dx = 0;
        let axis: 'x' | 'y' | null = null;
        let tracking = false;

        const ownsHorizontal = (target: EventTarget | null): boolean => {
            for (let el = target as HTMLElement | null; el && el !== node; el = el.parentElement) {
                if (el.matches('[data-no-swipe]')) return true;
                // A field you are typing in owns its drags (selecting text); one
                // you are not — a day's note, always editable — does not.
                if (el.matches('input, textarea, select, [contenteditable="true"]') && el === document.activeElement) return true;
                const style = getComputedStyle(el);
                if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
            }
            return false;
        };

        const moving = () => slideTarget(node);
        const setX = (x: number, opacity = 1) => {
            const target = moving();
            target.style.transform = x ? `translate3d(${x}px,0,0)` : '';
            target.style.opacity = opacity === 1 ? '' : String(opacity);
        };

        const onStart = (event: TouchEvent) => {
            if (event.touches.length !== 1 || ownsHorizontal(event.target)) { tracking = false; return; }
            const t = event.touches[0];
            startX = t.clientX; startY = t.clientY; startT = performance.now();
            dx = 0; axis = null; tracking = true;
            moving().style.transition = '';
        };

        const onMove = (event: TouchEvent) => {
            if (!tracking) return;
            const t = event.touches[0];
            const mx = t.clientX - startX;
            const my = t.clientY - startY;
            if (!axis) {
                if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
                axis = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
            }
            if (axis !== 'x') return;
            event.preventDefault();
            const { canPrev: p, canNext: n } = latest.current;
            const blocked = (mx > 0 && !p) || (mx < 0 && !n);
            dx = blocked ? mx * 0.25 : mx;
            setX(dx, blocked ? 1 : 1 - Math.min(Math.abs(dx) / node.clientWidth, 1) * 0.35);
        };

        const settle = () => {
            moving().style.transition = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 260ms';
            setX(0);
        };

        const onEnd = () => {
            if (!tracking) return;
            tracking = false;
            if (axis !== 'x') return;
            const { onPrev: prev, onNext: next, canPrev: p, canNext: n } = latest.current;
            const velocity = Math.abs(dx) / Math.max(performance.now() - startT, 1);
            const far = Math.abs(dx) > node.clientWidth * 0.3 || (Math.abs(dx) > 40 && velocity > 0.4);
            if (far && dx < 0 && n) { swipedRef.current = 'next'; next(); }
            else if (far && dx > 0 && p) { swipedRef.current = 'prev'; prev(); }
            settle();
        };

        node.addEventListener('touchstart', onStart, { passive: true });
        node.addEventListener('touchmove', onMove, { passive: false });
        node.addEventListener('touchend', onEnd);
        node.addEventListener('touchcancel', onEnd);
        return () => {
            node.removeEventListener('touchstart', onStart);
            node.removeEventListener('touchmove', onMove);
            node.removeEventListener('touchend', onEnd);
            node.removeEventListener('touchcancel', onEnd);
        };
    }, [enabled]);

    /* The new page slides in from the side it came from. */
    const lastKey = useRef(pageKey);
    const lastOrder = useRef(order);
    useLayoutEffect(() => {
        const root = ref.current;
        if (lastKey.current === pageKey) return;
        const forward = swipedRef.current ? swipedRef.current === 'next' : order > lastOrder.current;
        lastKey.current = pageKey;
        lastOrder.current = order;
        swipedRef.current = null;
        if (!root || typeof root.animate !== 'function' || !enabled) return;
        const node = slideTarget(root);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        node.style.transition = '';
        node.style.transform = '';
        node.style.opacity = '';
        node.animate(
            [
                { transform: `translate3d(${forward ? 48 : -48}px,0,0)`, opacity: 0 },
                { transform: 'translate3d(0,0,0)', opacity: 1 },
            ],
            { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
    }, [pageKey, order, enabled]);

    return ref;
}
