'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sheet } from './kit/Sheet';
import { Icon, type IconName } from './kit/icons';

const BASE = '/admin/honeymoon';

interface BarItem {
    href: string;
    label: string;
    icon: IconName;
    also?: string[];
    /** One line under the name in the More sheet. */
    hint?: string;
}

/** The four a thumb reaches for on the trip, plus More. */
const PRIMARY: BarItem[] = [
    { href: `${BASE}/today`, label: 'Today', icon: 'today' },
    { href: `${BASE}/itinerary`, label: 'Itinerary', icon: 'itinerary' },
    { href: `${BASE}/map`, label: 'Map', icon: 'map' },
    { href: `${BASE}/places`, label: 'Places', icon: 'places', also: [`${BASE}/stays`, `${BASE}/excursions`] },
];

const MORE: BarItem[] = [
    { href: BASE, label: 'Overview', icon: 'overview', hint: 'Where the trip stands' },
    { href: `${BASE}/travel`, label: 'Travel', icon: 'travel', hint: 'Flights, trains and transfers' },
    { href: `${BASE}/checklist`, label: 'Checklist', icon: 'checklist', hint: 'To-dos and packing' },
    { href: `${BASE}/files`, label: 'Files', icon: 'files', hint: 'Passports, tickets, bookings' },
    { href: `${BASE}/guide`, label: 'Guide', icon: 'guide', hint: 'Regions and know-before-you-go' },
    { href: `${BASE}/settings`, label: 'Settings', icon: 'settings', hint: 'Dates, money, sharing' },
];

function isOn(item: BarItem, pathname: string | null): boolean {
    if (item.href === BASE) return pathname === BASE || pathname === `${BASE}/`;
    return [item.href, ...(item.also ?? [])].some((href) => pathname?.startsWith(href));
}

/**
 * The phone's navigation: a floating pill along the bottom, where a thumb is.
 *
 * The same component style as Jarvis's tab bar — a frosted island lifted off
 * the bottom edge, line icons, and one highlight that slides between tabs
 * rather than each tab lighting up on its own. The slide is what makes a tap
 * feel like it went somewhere. Below 768px only; the desktop keeps its tab row.
 *
 * Pages leave room for it with `--hm-nav-clearance` (set in globals.css).
 */
export default function MobileTabBar() {
    const pathname = usePathname();
    const [more, setMore] = useState(false);
    const moreOn = MORE.some((item) => isOn(item, pathname));
    const activeIndex = moreOn ? PRIMARY.length : PRIMARY.findIndex((item) => isOn(item, pathname));

    const barRef = useRef<HTMLUListElement | null>(null);
    const itemRefs = useRef<(HTMLElement | null)[]>([]);
    const [pill, setPill] = useState<{ left: number; width: number; animate: boolean } | null>(null);
    const placed = useRef(false);

    /*
     * Place the highlight under the active tab. Measured rather than computed
     * from the column count, so it stays right whatever the labels' widths.
     * The first placement snaps; every later one slides.
     */
    const place = useCallback((animate: boolean) => {
        const bar = barRef.current;
        const target = itemRefs.current[activeIndex];
        if (!bar || !target || activeIndex < 0) { setPill(null); return; }
        const slot = bar.clientWidth / (PRIMARY.length + 1);
        const width = Math.min(slot * 0.92, target.offsetWidth * 1.15);
        const left = target.offsetLeft + target.offsetWidth / 2 - width / 2;
        setPill({ left, width, animate: animate && placed.current });
        placed.current = true;
    }, [activeIndex]);

    useLayoutEffect(() => { place(true); }, [place]);
    useEffect(() => {
        const bar = barRef.current;
        if (!bar || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => place(false));
        observer.observe(bar);
        return () => observer.disconnect();
    }, [place]);

    const itemClass = (on: boolean) => `relative z-[1] flex h-[3.25rem] w-full flex-col items-center justify-center gap-0.5
        rounded-full text-[11px] font-medium tracking-tight transition-colors duration-200
        [-webkit-tap-highlight-color:transparent] active:scale-95 motion-reduce:active:scale-100
        ${on ? 'text-gray-900' : 'text-gray-500'}`;

    return (
        <>
            <nav
                data-mobile-tabbar
                aria-label="Honeymoon sections"
                className="hm-tabbar md:hidden fixed inset-x-4 z-40 h-16 rounded-[30px] px-1.5"
            >
                <ul ref={barRef} className="relative grid h-full grid-cols-5 items-center">
                    {pill && (
                        <li
                            aria-hidden
                            className="hm-tabbar-pill pointer-events-none absolute top-1/2 h-[3.25rem] rounded-full"
                            style={{
                                width: pill.width,
                                transform: `translate(${pill.left}px, -50%)`,
                                transition: pill.animate ? undefined : 'none',
                            }}
                        />
                    )}
                    {PRIMARY.map((item, index) => {
                        const on = index === activeIndex;
                        return (
                            <li key={item.href} className="flex justify-center">
                                <Link
                                    ref={(node) => { itemRefs.current[index] = node; }}
                                    href={item.href}
                                    aria-current={on ? 'page' : undefined}
                                    className={itemClass(on)}
                                >
                                    <Icon name={item.icon} className="size-[23px]" strokeWidth={on ? 2.2 : 1.9} />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                    <li className="flex justify-center">
                        <button
                            ref={(node) => { itemRefs.current[PRIMARY.length] = node; }}
                            type="button"
                            onClick={() => setMore(true)}
                            aria-expanded={more}
                            aria-current={moreOn ? 'page' : undefined}
                            className={itemClass(moreOn)}
                        >
                            <Icon name="more" className="size-[23px]" />
                            More
                        </button>
                    </li>
                </ul>
            </nav>
            <Sheet open={more} onClose={() => setMore(false)} title={<h2 className="font-semibold text-gray-900">More</h2>}>
                <ul className="grid grid-cols-2 gap-2 pb-1">
                    {MORE.map((item) => {
                        const on = isOn(item, pathname);
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={() => setMore(false)}
                                    aria-current={on ? 'page' : undefined}
                                    className={`flex h-full min-h-[4.25rem] items-center gap-3 rounded-2xl border px-3 py-2.5
                                        transition active:scale-[0.97] motion-reduce:active:scale-100
                                        ${on ? 'border-accent/40 bg-accent/10' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                                >
                                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl
                                        ${on ? 'bg-white text-gray-900' : 'bg-white text-gray-500'} shadow-sm`}>
                                        <Icon name={item.icon} className="size-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[15px] font-semibold leading-tight text-gray-900">{item.label}</span>
                                        {item.hint && <span className="block text-[11px] leading-snug text-gray-500">{item.hint}</span>}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </Sheet>
        </>
    );
}
