'use client';

import { Icon } from './icons';

/**
 * The bar at the top of every tab: view switches on the left, the one primary
 * action and the ⋯ menu on the right.
 *
 * Sticky to the top of the shell's scroll container, so the controls of a long
 * page stay where your hand is. The itinerary's view switch scrolled away with
 * the first day card; this is the fix for every tab at once rather than one.
 * The negative margin lets the frosted background run edge to edge across the
 * page's own gutter.
 *
 * On a phone it never wraps. Wrapping is what made it cost a third of the
 * screen: the stays tab stacked five rows of pills before the first stay. Each
 * side becomes one row instead, and a row with more than fits scrolls sideways
 * (edge to edge, its scrollbar hidden). The primary action leaves the bar
 * altogether for a floating button above the tab bar (`fab`), where a thumb
 * reaches it on any tab, at any scroll position.
 */
export function TabToolbar({ left, right, below, className = '', stickyOnPhone = false, phoneOneRow = false, fab }: {
    left?: React.ReactNode;
    right?: React.ReactNode;
    /** A second line — active filter chips, a status note. */
    below?: React.ReactNode;
    className?: string;
    /**
     * Stay pinned on a phone too. Off by default: a toolbar that wraps to three
     * rows on a 390px screen would hold a third of it hostage. The itinerary
     * turns it on, because its day strip is the thing you navigate by.
     */
    stickyOnPhone?: boolean;
    /**
     * On a phone, put both sides on one row — for a tab whose right side is
     * only the ⋯ menu. Otherwise the right side takes a row of its own.
     */
    phoneOneRow?: boolean;
    /**
     * The tab's one primary action, as a floating button on a phone. The tab
     * hides its own button below `md` (`max-md:hidden`) when it passes this.
     */
    fab?: { label: string; onClick: () => void };
}) {
    const row = 'hm-scroll-row max-md:flex-nowrap max-md:overflow-x-auto max-md:-mx-4 max-md:px-4 max-md:max-w-none max-md:[&>*]:shrink-0';
    return (
        <>
            <div
                data-tab-toolbar
                className={`${stickyOnPhone ? 'sticky' : 'relative md:sticky'} top-0 z-20 -mx-4 md:-mx-6 mb-3 border-b border-gray-200/70
                    bg-gray-50/90 px-4 md:px-6 py-2 backdrop-blur ${className}`}
            >
                <div className={`flex flex-wrap items-center gap-2 ${phoneOneRow ? 'max-md:flex-nowrap' : ''}`}>
                    {left && (
                        <div className={`flex min-w-0 max-w-full flex-wrap items-center gap-2 ${row}
                            ${phoneOneRow ? 'max-md:flex-1 max-md:mr-0 max-md:pr-0' : 'max-md:w-[calc(100%+2rem)]'}`}>
                            {left}
                        </div>
                    )}
                    <div className="hidden md:block md:flex-1" />
                    {right && (
                        <div className={`md:ml-auto flex max-w-full flex-wrap items-center justify-end gap-2
                            ${phoneOneRow ? 'max-md:ml-auto max-md:shrink-0' : `max-md:justify-start ${row} max-md:w-[calc(100%+2rem)]`}`}>
                            {right}
                        </div>
                    )}
                </div>
                {below && <div className="mt-2">{below}</div>}
            </div>
            {fab && <Fab label={fab.label} onClick={fab.onClick} />}
        </>
    );
}

/**
 * The floating "add" button on a phone: bottom right, clear of the tab bar.
 * Rendered outside the toolbar, whose frosted background would otherwise
 * become the box `position: fixed` is measured against.
 */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className="md:hidden fixed right-4 bottom-[calc(var(--hm-nav-clearance)+0.75rem)] z-30 flex size-14
                items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-black/20
                transition active:scale-95 motion-reduce:active:scale-100"
        >
            <Icon name="plus" className="size-6" strokeWidth={2.4} />
        </button>
    );
}
